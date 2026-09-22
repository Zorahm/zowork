#!/usr/bin/env node
/**
 * SessionStart hook: refreshes the local cache of Anthropic's prompting guides
 * and puts a short pointer to it into the session context.
 *
 * Requires Node 18+ (global fetch). No shell, so it runs as-is on Windows, macOS and Linux.
 *
 * Hook contract:
 *   stdin  — the event JSON; unused, but drained to avoid EPIPE
 *   stdout — JSON with hookSpecificOutput.additionalContext
 *   exit   — always 0: a network failure must not break the session (fail-open)
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const DOCS_ORIGIN = 'https://platform.claude.com';
const INDEX_PATH = '/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices';
const MODEL_GUIDE_RE = /\/docs\/en\/build-with-claude\/prompt-engineering\/(prompting-claude-[a-z0-9-]+)/g;

const TTL_MS = 12 * 60 * 60 * 1000; // re-download window for already cached guides; new ones are fetched immediately
const FETCH_TIMEOUT_MS = 8_000;
const CONCURRENCY = 4;

const CACHE_DIR = join(
  process.env.CLAUDE_PLUGIN_DATA ?? join(homedir(), '.claude', 'prompt-guides'),
  'guides',
);
const META_PATH = join(CACHE_DIR, 'meta.json');
const SELF_PATH = fileURLToPath(import.meta.url);

/* ------------------------------------------------------------------ utils */

const drainStdin = () =>
  new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve();
    process.stdin.resume();
    process.stdin.on('data', () => {});
    process.stdin.on('end', resolve);
    process.stdin.on('error', resolve);
    setTimeout(resolve, 200).unref();
  });

const readMeta = async () => {
  try {
    return JSON.parse(await readFile(META_PATH, 'utf8'));
  } catch {
    return { fetchedAt: 0, entries: {} };
  }
};

const emit = (text) => {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text },
    }),
  );
  process.exit(0);
};

/** Rough HTML-to-text fallback for when the Markdown version of a page is unavailable. */
const htmlToText = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(p|div|section|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (_, e) =>
      ({ nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e],
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/**
 * Fetches a page as Markdown. Anthropic's docs serve a .md variant of every page;
 * if that fails, fall back to the HTML page.
 */
const fetchDoc = async (path, prevEtag) => {
  const headers = { 'user-agent': 'claude-prompt-guides/0.1' };
  if (prevEtag) headers['if-none-match'] = prevEtag;

  for (const url of [`${DOCS_ORIGIN}${path}.md`, `${DOCS_ORIGIN}${path}`]) {
    let res;
    try {
      res = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    } catch {
      continue;
    }
    if (res.status === 304) return { unchanged: true };
    if (!res.ok) continue;

    const body = await res.text();
    const looksLikeHtml = /^\s*(<!doctype|<html)/i.test(body);
    return {
      text: looksLikeHtml ? htmlToText(body) : body,
      etag: res.headers.get('etag') ?? undefined,
    };
  }
  return null;
};

const mapWithLimit = async (items, limit, fn) => {
  const out = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...(await Promise.all(items.slice(i, i + limit).map(fn))));
  }
  return out;
};

/* ------------------------------------------------------------------- main */

const pointer = (slugs) =>
  [
    "Anthropic's current prompting guides are cached locally in:",
    `  ${CACHE_DIR}`,
    `  best-practices.md${slugs.length ? `, ${slugs.map((s) => `${s}.md`).join(', ')}` : ''}`,
    'Read them through the zowork:prompt-guides skill when writing or editing prompts, system prompts,',
    'skills or agent instructions; leave them closed otherwise.',
    `Manual refresh: CLAUDE_PLUGIN_DATA="${dirname(CACHE_DIR)}" node "${SELF_PATH}" < /dev/null`,
  ].join('\n');

await drainStdin();

const meta = await readMeta();
meta.entries ??= {};
const knownSlugs = Object.keys(meta.entries).filter((s) => s !== 'best-practices');
const stale = Date.now() - (meta.fetchedAt ?? 0) >= TTL_MS;

await mkdir(CACHE_DIR, { recursive: true });

// The index is checked on every session start, not only after the TTL: otherwise a guide
// published right after a refresh stays invisible for up to TTL_MS. The TTL only gates
// re-downloading guides that are already cached.
const index = await fetchDoc(INDEX_PATH, meta.entries['best-practices']?.etag);
if (!index) {
  emit(knownSlugs.length ? pointer(knownSlugs) : "Anthropic's prompting guides are unavailable right now (network).");
}

const indexText = index.unchanged
  ? await readFile(join(CACHE_DIR, 'best-practices.md'), 'utf8').catch(() => '')
  : index.text;

if (!index.unchanged) {
  await writeFile(join(CACHE_DIR, 'best-practices.md'), indexText, 'utf8');
  meta.entries['best-practices'] = { etag: index.etag };
}

const slugs = [...new Set([...indexText.matchAll(MODEL_GUIDE_RE)].map((m) => m[1]))];
const toFetch = stale ? slugs : slugs.filter((s) => !knownSlugs.includes(s));

const results = await mapWithLimit(toFetch, CONCURRENCY, async (slug) => {
  const doc = await fetchDoc(
    `/docs/en/build-with-claude/prompt-engineering/${slug}`,
    meta.entries[slug]?.etag,
  );
  if (!doc) return { slug, ok: false };
  if (!doc.unchanged) {
    await writeFile(join(CACHE_DIR, `${slug}.md`), doc.text, 'utf8');
    meta.entries[slug] = { etag: doc.etag };
  }
  return { slug, ok: true };
});

// A new guide that failed to download stays out of meta and is retried next session.
const fetched = new Set(results.filter((r) => r.ok).map((r) => r.slug));
const available = slugs.filter((s) => fetched.has(s) || knownSlugs.includes(s));
const added = available.filter((s) => !knownSlugs.includes(s));

if (stale) meta.fetchedAt = Date.now();
await writeFile(META_PATH, JSON.stringify(meta, null, 2), 'utf8');

const note = added.length
  ? `\nNewly cached since the last session: ${added.map((s) => `${s}.md`).join(', ')}.`
  : '';
emit(pointer(available) + note);
