#!/usr/bin/env node
/**
 * SessionStart hook: обновляет локальный кэш промпт-гайдов Anthropic
 * и отдаёт в контекст короткий указатель на него.
 *
 * Требования: Node 18+ (global fetch). Никакого shell — работает как есть
 * на Windows, macOS и Linux.
 *
 * Контракт хука:
 *   stdin  — JSON события (не используется, но вычитывается, чтобы не словить EPIPE)
 *   stdout — JSON с hookSpecificOutput.additionalContext
 *   exit   — всегда 0: сеть не должна ломать сессию (fail-open)
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DOCS_ORIGIN = 'https://platform.claude.com';
const INDEX_PATH = '/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices';
const MODEL_GUIDE_RE = /\/docs\/en\/build-with-claude\/prompt-engineering\/(prompting-claude-[a-z0-9-]+)/g;

const TTL_MS = 12 * 60 * 60 * 1000; // сутки пополам: доки живые, но не поминутные
const FETCH_TIMEOUT_MS = 8_000;
const CONCURRENCY = 4;

const CACHE_DIR = join(
  process.env.CLAUDE_PLUGIN_DATA ?? join(homedir(), '.claude', 'prompt-guides'),
  'guides',
);
const META_PATH = join(CACHE_DIR, 'meta.json');

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

/** Мягкий HTML → текст на случай, если markdown-вариант страницы недоступен. */
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
 * Тянет страницу как markdown. Доки Anthropic — на Mintlify, где у любой
 * страницы есть .md-вариант; если он вдруг отдаст не то, откатываемся на HTML.
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
    'Актуальные промпт-гайды Anthropic закэшированы локально:',
    `  ${CACHE_DIR}`,
    `  best-practices.md${slugs.length ? `, ${slugs.map((s) => `${s}.md`).join(', ')}` : ''}`,
    'Читай их через скилл prompt-guides, когда пишешь или правишь промпты,',
    'системные промпты, скиллы или инструкции для агентов. Без надобности не открывай.',
  ].join('\n');

await drainStdin();

const meta = await readMeta();
const knownSlugs = Object.keys(meta.entries ?? {});

if (Date.now() - (meta.fetchedAt ?? 0) < TTL_MS && knownSlugs.length > 0) {
  emit(pointer(knownSlugs)); // кэш свежий — в сеть не ходим вообще
}

await mkdir(CACHE_DIR, { recursive: true });

const index = await fetchDoc(INDEX_PATH, meta.entries?.['best-practices']?.etag);
if (!index) {
  emit(knownSlugs.length ? pointer(knownSlugs) : 'Промпт-гайды Anthropic сейчас недоступны (сеть).');
}

let indexText = index.unchanged
  ? await readFile(join(CACHE_DIR, 'best-practices.md'), 'utf8').catch(() => '')
  : index.text;

if (!index.unchanged) {
  await writeFile(join(CACHE_DIR, 'best-practices.md'), indexText, 'utf8');
  meta.entries['best-practices'] = { etag: index.etag };
}

const slugs = [...new Set([...indexText.matchAll(MODEL_GUIDE_RE)].map((m) => m[1]))];

const results = await mapWithLimit(slugs, CONCURRENCY, async (slug) => {
  const doc = await fetchDoc(
    `/docs/en/build-with-claude/prompt-engineering/${slug}`,
    meta.entries?.[slug]?.etag,
  );
  if (!doc) return { slug, ok: knownSlugs.includes(slug) };
  if (!doc.unchanged) {
    await writeFile(join(CACHE_DIR, `${slug}.md`), doc.text, 'utf8');
    meta.entries[slug] = { etag: doc.etag };
  }
  return { slug, ok: true };
});

meta.fetchedAt = Date.now();
await writeFile(META_PATH, JSON.stringify(meta, null, 2), 'utf8');

emit(pointer(results.filter((r) => r.ok).map((r) => r.slug)));
