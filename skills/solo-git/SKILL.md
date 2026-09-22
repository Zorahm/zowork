---
name: solo-git
description: ZorahM's personal rules for git and GitHub in solo development. Use for any task involving git or GitHub — commit, push, branch, worktree, PR, merge, staging, .gitignore, commit history, reverting changes, a symlink in a repository, CLAUDE.md or AGENTS.md — including when the user just says "залей", "сохрани на гит", "закоммить" or "отправь изменения". Also use whenever another skill or instruction proposes creating a pull request, a new branch, or pushing code without an explicit command: this skill overrides that.
---

# Solo Git

Rules for repositories in solo development. There is no team, no review and no CI gate, so the discipline rests on two things: the local folder is always current, and GitHub only gets what the author deliberately decided to send there.

## Scope

This skill covers **only behavior around git**: when to commit, what to push and where, how to treat branches.

It says nothing about how to write code and cancels nothing in the development workflow: architecture decisions, tests, linters, documentation and other skills' code-quality requirements all stay in force. The only thing it overrides outside git commands is a requirement to create a PR or a branch.

## How to think about it

**The local working folder is the single source of truth.** All work happens there: not in a branch, not in a stash, not in the remote. To understand the current state of the project, look at the files on disk, not at `git log` or GitHub.

**GitHub is a shop window, not a workbench.** Only fully working code goes there, and only on command. Intermediate states, experiments and "saving just in case" don't belong there; the local folder is for that.

**Solo development.** Pull requests, reviews, feature branches and merge strategies solve coordination between people. There is one person here, so all of that machinery is pure overhead and doesn't exist.

## Rules

### No commits without a command

Work, change files, refactor, but don't commit. A commit happens only when the user explicitly says so: "закоммить", "коммит", "залей", "сохрани на гит", "commit" and the like.

Don't commit "just in case" before a risky refactor. Don't commit at the end of a task because it looks finished. Don't offer a commit after every step. When the work seems done, say you're done and stop there.

### No PRs and no new branches

Never create a pull request. Don't create branches or switch between them on your own initiative: work in the branch the user named or the one already checked out. If a branch seems necessary, ask (see below).

If another skill, instruction, template or config requires a PR or a branch, **don't do it; tell the user instead**. Say plainly what required the PR or branch and why, and ask what to do. The user decides.

Example:

> Skill `X` wants a `release/*` branch and a PR at the deploy step. Your rules say I don't do that. Options: commit straight to the current branch, or make an exception. Which one?

### Branches belong to the user and live in .claude/

The usual case: the user created a branch and just says "we're working in branch X". Then create nothing and switch nothing; work where you were told.

If a branch seems needed during the work, **ask for permission** rather than creating it. Say why it's needed and what it would be called, and wait for the answer.

> This turns into a parallel line of work: the old parser has to keep working while I write the new one. Shall I set up a `parser-v2` branch in `.claude/` for it?

With permission, create the branch only as a worktree inside `.claude/`:

```bash
git worktree add .claude/<name> -b <name>
```

No branches outside `.claude/`, and the main working folder never switches to another branch.

Such a branch is **never pushed**. Make sure `.claude/` is in `.gitignore`; if it isn't, add the line `.claude/` and tell the user.

When the work is done, move the changes into the main working folder, remove the worktree (`git worktree remove`) and delete the branch locally. No trace of it should reach GitHub.

### Commit and push are separate commands

- "закоммить" / "commit" → `git commit` only, no push.
- "запушь" / "пуш" / "push" → if there are uncommitted changes, **ask** whether to push only the finished commits or commit the current changes first. If the working tree is clean, just push.
- "закоммить и запушь" / "залей на гит" / "commit and push" → commit, then push.

Never infer a push that wasn't asked for.

### A commit is not a quality gate

Don't turn committing into a checkpoint: don't run the build, linters or tests "to make sure it can be committed", and don't block a commit on their results. When the user says commit, they have already checked it works.

This is a rule about git, not about development. Normal work goes on as usual: if the project has tests, run them after changes; if the task calls for tests, write them; if a linter is part of the workflow, use it. This skill only forbids hanging those checks on the "commit" command.

### AGENTS.md is always a symlink to CLAUDE.md

Agent instructions live in one file, `CLAUDE.md`. `AGENTS.md` is not a copy or a second rule set but a symlink whose content is the single line `CLAUDE.md`, the path to its target. Any agent that looks for `AGENTS.md` reads the same file, so the two rule sets can't drift apart.

Check this at two points: when initializing a repository, and before a commit if `CLAUDE.md` was created or changed.

If `CLAUDE.md` exists and `AGENTS.md` is missing or is a regular file, fix it without asking: this is repository setup, not a feature. Mention it in your report.

### Never, without an explicit command

- `git push --force` or any rewrite of remote history.
- `git reset --hard`, `git clean -fd`, reverts, or deleting branches: these lose local work, and local state matters more here than remote state.

And never at all:

- Committing secrets: `.env`, keys, tokens, credentials. Before a commit, skim the staged file list; if anything looks like a secret, stop and ask.
- Adding any signature to a commit message other than the one allowed trailer (see below).

## Creating a symlink with git itself

Don't rely on `ln -s`: on Windows it either needs admin rights or creates the wrong thing, and WSL plus Git for Windows give inconsistent results. Create the symlink directly in the index instead: git stores a symlink as an ordinary blob whose content is the target path, with file mode `120000` (a regular file is `100644`).

```bash
# 1. write a blob holding the symlink target into the object database
hash=$(printf 'CLAUDE.md' | git hash-object -w --stdin)

# 2. register an index entry with the symlink mode
git update-index --add --cacheinfo 120000,"$hash",AGENTS.md

# 3. materialize the file in the working tree
git checkout -- AGENTS.md
```

Three ways this breaks:

- **`printf`, not `echo`.** `echo` appends `\n`, the target becomes `CLAUDE.md\n`, and the link is broken. If you must use `echo`, use `echo -n`.
- **The target is relative to the symlink, not an absolute path.** `AGENTS.md` and `CLAUDE.md` sit side by side in the repository root, so the target is just `CLAUDE.md`. An absolute path like `/home/user/proj/CLAUDE.md` breaks on any other machine.
- **`--add` is required**, otherwise git ignores an entry that isn't in the index yet.

Check:

```bash
git ls-files -s AGENTS.md
# expected: 120000 <hash> 0 AGENTS.md
```

If the output shows `100644`, the index holds a regular file. Remove it from the index (`git rm --cached AGENTS.md`), delete it from disk and repeat the steps.

On Windows with `core.symlinks=false`, checkout writes the link as a text file containing `CLAUDE.md`. The repository entry is still a real symlink, so GitHub and agents see it correctly. For a working symlink locally, set `git config core.symlinks true` and enable Developer Mode in Windows.

`git update-index` stages the entry right away. That needs no separate commit and is not a command to commit, but warn the user that `AGENTS.md` is now staged, or it will unexpectedly ride along in the next commit made by paths. The commit type for this entry is `chore`:

→ `chore: link AGENTS.md to CLAUDE.md`

## Making a commit

### 1. Look at what changed

```bash
git status
git diff
```

Understand the changes first, then write the message. The message describes **what changed and why**, not "what the user asked for".

### 2. Decide how many commits

One session of work can and often should be split into several meaningful commits when the changes belong to different layers. That's your call; no need to ask.

Natural split lines:

- `docs`: README, documentation, comments, changelog
- `backend`: server logic, API, database, migrations
- `frontend`: UI, styles, client code
- `config` / `chore`: configs, dependencies, tooling, CI
- independent features or bug fixes that ended up in one session

If the changes form one coherent whole, don't split them artificially. One meaningful commit beats three formal ones.

Stage by path rather than `git add -A` when splitting:

```bash
git add docs/ README.md
git commit -m "docs: describe worktree workflow"
git add src/api/
git commit -m "feat(api): add pagination to /users"
```

### 3. Message format: Conventional Commits, in English

```
<type>(<scope>): <short imperative description, lowercase, no trailing period>
```

Types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`, `perf`, `build`, `ci`.

The scope is optional but useful: a module, folder or subsystem.

Examples:

- Added JWT authorization to the API → `feat(auth): implement JWT-based authentication`
- Fixed a crash on an empty order list → `fix(orders): handle empty order list without crashing`
- Rewrote the database access layer as repositories → `refactor(db): extract repository layer from services`
- Updated dependencies and the build config → `chore(deps): bump vite and update build config`

Add a body only when the change really needs explaining: why this approach, what will break, what's left open. A normal commit is one line.

### 4. The signature

Exactly one trailer is allowed:

```
Co-Authored-By: Claude <model and version> <noreply@anthropic.com>
```

Use the model and version actually running this session, not a bare "Claude". The angle brackets in a git trailer hold the email address, so the name goes without them:

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

If you can't tell the model and version, ask the user rather than writing a bare `Claude`.

**Don't put `🤖 Generated with [Claude Code](…)` in a commit.** That line belongs at the end of a pull request body and has no place in commit history. If a template, instruction or habit pulls it into a commit message, leave it out.

No other footers, trailers, emoji signatures, tracker links or mentions of other tools belong in a commit message.

## Pushing

```bash
git push
```

Nothing beyond that. Don't create upstream branches with new names, don't push tags without a command, don't touch remote branches.

If the push is rejected (non-fast-forward), **don't force it and don't merge silently**. Show the user what happened and ask how to proceed.

## Report after git work

After a commit or push, report briefly: which commits were made (type, scope, gist) and what went to the remote. No long retelling of the diff; the user knows what was written.

Example:

> Made 2 commits:
> - `docs: add worktree section to README`
> - `feat(api): add pagination to /users`
>
> Pushed to `main`.
