# Contributing to AstroCalc

This document is the practical, human-facing companion to
[CLAUDE.md](./CLAUDE.md) (which is written for AI coding agents but applies
equally to everyone). If the two ever disagree, this file and CLAUDE.md
should be reconciled — they describe the same workflow.

## Workflow

Every change — features, fixes, docs, chores — follows the same flow:

1. **Pull `main` before starting.**
   ```
   git checkout main
   git pull origin main
   ```
   Never branch from a stale local `main`.

2. **Work against a GitHub issue.** If one doesn't exist for what you're
   about to do, create it first (see [Issues, Labels & Milestones](#issues-labels--milestones)
   below). This keeps `BACKLOG.md` and the milestone boards accurate, and
   gives every branch/PR a number to reference.

3. **One branch per task**, named:
   ```
   <type>/<issue-number>-<short-kebab-slug>
   ```
   - `type` is one of: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`
   - `issue-number` is the GitHub issue or sub-issue this branch closes
   - `short-kebab-slug` is a few words describing the change, lowercase, hyphenated

   Examples:
   - `feat/2-google-oauth-integration`
   - `fix/16-timezone-dst-bug`
   - `docs/24-readme-and-contributing`

4. **Commit messages** follow [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   <type>: <short summary>

   <optional body — explain why, not what>
   ```
   Use the same `type` values as the branch prefix (`feat`, `fix`, `chore`,
   `docs`, `refactor`, `test`, `ci`). Reference the issue in the body when
   it isn't already obvious from the branch (`Closes #12`, `Refs #12`).

5. **Open a PR — labels are mandatory.** Every PR must carry at least:
   - The same labels as the source issue (e.g. `mobile`, `backend`,
     `calc-engine`, `i18n`, `security`, plus a priority label if the issue
     has one)
   - Never open or merge a PR with zero labels

   The PR description should:
   - Summarize what changed and why (not just what — the diff shows what)
   - Reference the issue it closes (`Closes #N`)
   - Include a test plan / how it was verified

6. **Log finished work in `BACKLOG.md`.** Once a task is merged (or ready
   for review, if that's the point you consider it "done"), add a dated
   entry summarizing it and linking the issue/PR numbers. Keep entries
   short — one or two lines per task, reverse-chronological.

## Issues, Labels & Milestones

- **Epics** are top-level feature areas (`[EPIC] ...` title, `epic` label).
  Each Epic is broken into sub-issues, linked two ways: GitHub's native
  sub-issue relation, and a `Parent Epic: #N` line in the sub-issue body.
- **Sub-issues** follow this body template:
  ```
  ## Description
  ## Acceptance Criteria
  ## Technical Notes
  ## Design Reference (if any)
  ## Dependencies
  ## Parent Epic
  ```
- **Labels** in use: `epic`, `mobile`, `backend`, `admin-panel`, `website`,
  `design`, `i18n`, `security`, `calc-engine`, `chore`, `p0`/`p1`/`p2`
  (priority), `needs-design`, `needs-research`, plus GitHub's defaults
  (`bug`, `documentation`, etc.). Apply every label that's relevant — an
  issue can be both `mobile` and `security`, for instance.
- **Milestones** (`M0`–`M7`) map to the project roadmap phases — see the
  [README](./README.md#roadmap--milestones). Assign the milestone that
  matches when the work is meant to land, not necessarily when it was
  filed.

## PR Checklist

Before requesting review / merging:

- [ ] Branch pulled from an up-to-date `main`, named per convention
- [ ] Labels applied (matching the source issue, at minimum)
- [ ] PR description references the issue (`Closes #N`)
- [ ] Tests added/updated for the change, and passing locally
- [ ] For anything touching `packages/calc-engine`: accuracy-relevant
  changes are covered by unit tests, cross-checked against a reference
  calculator where applicable (see the calc-engine epics for examples)
- [ ] `BACKLOG.md` updated with a one-line entry

## Code Style

Lint/formatting tooling is set up at the repo root and applies to every
workspace (`apps/*`, `packages/calc-engine`) — no per-package config needed.

- **ESLint** (flat config, `eslint.config.js`) — `@eslint/js` recommended
  rules plus `typescript-eslint`'s `strict` and `stylistic` rule sets.
  TypeScript strict-mode lint rules are enabled repo-wide, matching the
  [Tech Stack](./README.md#tech-stack) decision to run mobile/backend in
  TypeScript strict mode.
- **Prettier** (`.prettierrc.json`) — owns formatting; `eslint-config-prettier`
  disables any ESLint stylistic rule that would fight it. Config: single
  quotes, semicolons, trailing commas, 100-char print width. Markdown prose
  files (`*.md`) are excluded from Prettier — see `.prettierignore` — so
  hand-wrapped docs like this one aren't auto-reflowed.
- **TypeScript** (`tsconfig.base.json`) — `strict: true` plus
  `noUncheckedIndexedAccess`, `noImplicitOverride`, and
  `exactOptionalPropertyTypes`. Each package's `tsconfig.json` should
  `"extends": "<path-to-root>/tsconfig.base.json"`.

Commands (run from the repo root):

```
npm install           # one-time, installs the shared lint/format tooling
npm run lint           # ESLint, no autofix
npm run lint:fix       # ESLint with --fix
npm run format         # Prettier --write
npm run format:check   # Prettier --check (what CI runs)
```

CI runs `npm run lint` and `npm run format:check` on every push to `main`
and every PR (`.github/workflows/lint.yml`) — a red check blocks merge.
There's no pre-commit hook yet; running `npm run lint` and
`npm run format:check` locally before opening a PR is the current
expectation.

## Local Development Setup

Not applicable yet — there's no application code to run. This section will
be written once `apps/` and `packages/calc-engine` are scaffolded.

## Questions

Open a GitHub issue with the `needs-research` label if something about the
scope or approach is unclear — that keeps the discussion attached to the
work instead of getting lost.
