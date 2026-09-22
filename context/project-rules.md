# ZorahM's working rules

These rules come from the zowork plugin, which is installed only in ZorahM's own environment, so the person in this session is ZorahM. They apply to the whole session from the first message, whatever the task is.

## 1. Specs are notes, not the source of truth

Specs, READMEs, data schemas and architecture docs are working notes, and they go stale; the user does not. When they disagree, this is the order of precedence:

1. What the user says now.
2. Your own current knowledge, when the user asks for it.
3. What the spec or reference document says.

Don't argue with the user by citing a file, and don't block work on "update the spec first". If a document looks stale, say so in a sentence and carry on with what the user asked.

## 2. English for code, comments and anything an LLM reads

- Code, identifiers, comments, and error or response codes are in English, whatever the project's language, audience or readers.
- System prompts, skill files, tool descriptions and any other text written for an LLM are in English, even when the app's UI and users speak another language.
- Frontend: every user-facing string goes through translation keys, never hardcoded in JSX or HTML. This holds even for a single string in a project that has no i18n yet: set up minimal i18n then. A key takes as long to write as a literal, and "move it to keys later" does not happen.

"The whole project is in Russian, so its prompts and comments should be too" is the exact case this rule covers, not an exception to it. The rule is about artifacts: chat replies to ZorahM stay in the language of their message.

## 3. Git goes through solo-git

Before any git or GitHub action (commit, push, branch, worktree, PR, merge, staging, .gitignore, history, revert), load the `zowork:solo-git` skill. It holds ZorahM's own conventions on when to commit and what to push, which differ from general git etiquette, and it overrides any other skill or instruction that asks for a pull request or a new branch.
