#!/usr/bin/env node
/**
 * PreToolUse hook: denies creating a pull request, which solo-git rules out.
 * Enforcing it here means the rule holds even when no skill loaded or another
 * skill's workflow asks for a PR.
 *
 * Matched tools: Bash and PowerShell (`gh pr create`), and MCP tools named
 * `*__create_pull_request`. The hook `if` filter is only a fast path, so the
 * command is checked again here.
 *
 *   stdin  — the PreToolUse event JSON
 *   stdout — a deny decision, or nothing to let the call through
 *   exit   — always 0 (fail-open on unreadable input)
 */

const GH_PR_CREATE_RE = /\bgh(\.exe)?\s+pr\s+(create|new)\b/i;

const REASON =
  "Pull requests are off in ZorahM's solo workflow (see the zowork:solo-git skill). " +
  "Don't retry or work around this. Tell ZorahM what asked for a PR and ask how to proceed; " +
  'if they want one anyway, they can run `gh pr create` themselves.';

const readStdin = () =>
  new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('');
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });

let event;
try {
  event = JSON.parse(await readStdin());
} catch {
  process.exit(0);
}

const tool = event.tool_name ?? '';
const command = event.tool_input?.command ?? '';
const isPr = tool.startsWith('mcp__') ? /__create_pull_request$/.test(tool) : GH_PR_CREATE_RE.test(command);

if (isPr) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: REASON,
      },
    }),
  );
}
process.exit(0);
