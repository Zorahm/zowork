# ZoWork

Personal skills for ZorahM's workflow with Claude Code. These are clearly **not for everyone** — they encode one person's specific habits and preferences.

If you've read through them and like what you see, feel free to use them. Just keep in mind that everyone has their own way of working, and what fits here might not fit you.

## What's inside

- **Working rules** (`context/project-rules.md`): injected into every session by a SessionStart hook, so they apply from the first message: specs versus the user, English for code and LLM-facing text, git through `solo-git`.
- **`prompt-guides`** skill and a SessionStart hook that caches Anthropic's per-model prompting guides locally and picks up new models automatically.
- **`solo-git`** skill: when to commit and push, no PRs, branches only as worktrees in `.claude/`, commit message format.
- **`antigravity`** skill: handing research and bulk mechanical work to the Antigravity CLI agent (`agy`).

Requires Node 18+ for the hooks.

## Installation

This is a [Claude Code](https://claude.com/claude-code) plugin marketplace.

### CLI

```
/plugin marketplace add zorahm/zowork
/plugin install zowork@zowork
```

Or, from a local clone:

```
/plugin marketplace add /path/to/zowork
/plugin install zowork@zowork
```

### claude.ai (Desktop, Web)

Not available on mobile. In the app: **Code** tab → **Customize** → **Plugins** tab → **Add** → **Marketplace** → **From GitHub**, then enter `zorahm/zowork`.

## License

MIT — see [LICENSE](LICENSE).
