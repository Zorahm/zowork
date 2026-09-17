#!/usr/bin/env node
/**
 * SessionStart hook: без сети и без кэша — просто фиксирует в контексте,
 * что плагин zowork виден в этой сессии, а значит это окружение ZorahM.
 *
 * Контракт хука тот же, что у refresh-guides.mjs:
 *   stdin  — вычитывается вхолостую, чтобы не словить EPIPE
 *   stdout — JSON с hookSpecificOutput.additionalContext
 *   exit   — всегда 0
 */

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

const text = [
  'Плагин zowork виден в этой сессии — значит он установлен здесь, а значит это окружение ZorahM.',
  'Скилл project-rules — не эвристика по ключевым словам в задаче, а контракт на всю сессию:',
  'применяй его с первого сообщения, а не только когда формулировка задачи совпала с описанием скилла.',
].join('\n');

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text },
  }),
);
process.exit(0);
