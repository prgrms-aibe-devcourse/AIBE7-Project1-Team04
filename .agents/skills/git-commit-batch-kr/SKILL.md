---
name: git-commit-batch-kr
description: Split repository changes into small conventional commits, write messages in the form `English category: 한글 메시지`, and push the result safely. Use when the user asks to stage, commit, and push work, especially when changes should be divided into multiple focused commits.
---

# Git Commit Batch KR

## Goal

Turn a dirty working tree into a sequence of small, reviewable git commits, then push them.

## Workflow

1. Inspect the working tree with `git status --short` and `git diff --stat --`.
2. Group changes by one logical concern, not by file count.
3. Exclude secrets and unrelated files by default, especially `.env`, credentials, or generated junk.
4. Stage only one group at a time.
5. Commit each group with a conventional message in this form:
   `feat: 한글 메시지`
6. Repeat until the intended changes are committed.
7. Push after the commit series is complete.

## Commit Splitting Rules

- Split by intent first: feature, fix, docs, chore, refactor, style, test, build, ci, perf.
- Do not mix documentation with code changes unless they are inseparable.
- Do not mix formatting-only changes with logic changes.
- Keep each commit small enough to explain in one sentence.
- If a file contains multiple unrelated edits, stage hunks selectively instead of the whole file.
- If a clean split is not possible, choose the smallest coherent grouping and explain the tradeoff.

## Message Format

- Use a lowercase English category followed by a colon and a space, then a concise Korean summary.
- Keep the Korean message specific to the commit scope.
- Prefer these categories:
  - `feat` for new functionality
  - `fix` for bug fixes
  - `docs` for documentation
  - `chore` for maintenance, scaffolding, or housekeeping
  - `refactor` for structural code changes without behavior changes
  - `style` for formatting-only work
  - `test` for test updates
  - `build` for build or dependency changes
  - `ci` for CI workflow changes
  - `perf` for performance improvements

## Push Rules

- Push only after the planned commit set is complete.
- If the remote push fails, retry once after checking branch and remote state.
- Report any skipped files, especially sensitive files that were left uncommitted.

## Safety Checks

- Never commit `.env` or real secrets unless the user explicitly requests it.
- Never force-push unless the user explicitly asks.
- Never rewrite existing commits unless the user asks.
- If the user asks for "commit and push" and the tree contains many unrelated changes, create multiple focused commits rather than one large commit.

