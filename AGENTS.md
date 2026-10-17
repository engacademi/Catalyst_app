# Agent instructions

## Worktrees

Every feature or fix gets its own git worktree on its own branch. The main checkout stays on `main` and only receives merges.

Before the first edit for new work:

1. Branch from `main` as `feat/<slug>` or `fix/<slug>`: `git worktree add .worktrees/<branch> -b <branch> main`
2. Do all edits, commands, and commits from inside `.worktrees/<branch>`.

Under `/implement-spec`, ticket worktrees branch from its integration branch instead of `main`; the integration branch itself branches from `main`.

Done when the work's commits are on its branch and `git status` in the main checkout shows a clean tree.

After the branch merges: `git worktree remove .worktrees/<branch>` then `git branch -d <branch>`.

Continuing existing work: `git worktree list` shows the open worktrees; resume in the matching one.

## Case study

`docs/requirements/` holds the hackathon case study:

- `source/`: the organizer's original files, kept exactly as received.
- `resources.md`: index of every link and file, one row each.
- `requirements.md`: structured requirements, each citing its resource.

Read `requirements.md` before planning or building a feature. Record decisions as ADRs in `docs/adr/`.
