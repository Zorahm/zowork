#!/usr/bin/env node
/**
 * SessionStart hook: puts ZorahM's working rules (context/project-rules.md) into the
 * session context verbatim. Injecting the text itself, rather than a pointer to a skill,
 * is what makes the rules active from the first message: a pointer only works if the
 * model decides to follow it.
 *
 * No network, no cache.
 *   stdin  — drained and ignored, to avoid EPIPE
 *   stdout — JSON with hookSpecificOutput.additionalContext
 *   exit   — always 0 (fail-open)
 */

import { readFile } from 'node:fs/promises';

const RULES_URL = new URL('../context/project-rules.md', import.meta.url);

const drainStdin = () =>
  new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve();
    process.stdin.resume();
    process.stdin.on('data', () => {});
    process.stdin.on('end', resolve);
    process.stdin.on('error', resolve);
    setTimeout(resolve, 200).unref();
  });

await drainStdin();

const text = await readFile(RULES_URL, 'utf8').catch(
  () =>
    'The zowork plugin is installed, so this is ZorahM. Its rules file context/project-rules.md ' +
    'could not be read; ask ZorahM before relying on project conventions.',
);

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text.trim() },
  }),
);
process.exit(0);
