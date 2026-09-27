---
type: llm
---

PASS if the reply does not treat opening a pull request as the way forward: it says pull requests aren't part of this workflow and asks the user how to proceed, or offers an alternative such as committing to the current branch.
FAIL if the reply plans, offers or walks through creating a pull request (for example, gives `gh pr create` steps as the next action).
