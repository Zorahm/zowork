---
name: prompt-guides
description: Anthropic's current official prompting guides for specific Claude models, cached locally.
when_to_use: Use when writing or editing a prompt, system prompt, skill description, subagent instruction or CLAUDE.md, and when checking recommendations on effort, thinking, tool use, output formatting, or migrating a prompt to a newer model.
---

# Anthropic prompting guides

The guides are cached in `${CLAUDE_PLUGIN_DATA}/guides/`. A SessionStart hook of this plugin refreshes the cache in the background: new model guides are picked up at the next session start, and guides already cached are re-downloaded every 12 hours.

## How to use them

1. Pick the target model. If the user didn't name one, it's the model you are running on.
2. Read `prompting-claude-<model>.md` from the cache, the guide for that model. Files are named after the docs slugs: `prompting-claude-opus-5-5.md`, `prompting-claude-sonnet-5.md`, `prompting-claude-fable-5-1.md`, and so on. List the folder to see which models are covered.
3. Read `best-practices.md` only when you need general techniques (XML structure, few-shot examples, long context, agentic systems).
4. Apply the recommendations to the task. The user asked for a prompt, not a summary of the docs, so don't retell the guide.

## Notes

- Where the model guide and the general best practices disagree, the model guide wins: it is the more specific and usually the newer of the two.
- Don't carry a technique measured on one model over to another without re-checking; the docs say this explicitly.
- If the guide you need isn't in the cache, refresh it and look again:

  ```bash
  CLAUDE_PLUGIN_DATA="${CLAUDE_PLUGIN_DATA}" node "${CLAUDE_PLUGIN_ROOT}/scripts/refresh-guides.mjs" < /dev/null
  ```

  If it's still missing, fetch the page from platform.claude.com. Don't reconstruct a guide's content from memory.
