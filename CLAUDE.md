# AstroCalc — Project Instructions

Zodiac/astrology, natal chart, numerology, and Matrix of Destiny calculation
app. Free/Pro subscription model. See GitHub issues (Epics + sub-issues) for
the full functional breakdown.

## GitHub Workflow

Every task — including small doc/chore work — follows this flow:

1. **Pull `main` first.** `git checkout main && git pull origin main` before
   branching, so work always starts from a current base.
2. **One branch per task**, named:
   `<type>/<issue-number>-<short-kebab-slug>`
   - `type` ∈ `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`
   - `issue-number` is the GitHub issue/sub-issue the branch closes
   - Examples: `feat/2-google-oauth-integration`, `fix/16-timezone-dst-bug`,
     `chore/22-backlog-and-workflow-docs`
3. **Labels are mandatory on the PR.** Carry over the source issue's labels
   (e.g. `mobile`, `backend`, `calc-engine`, priority) onto the PR when
   opening it — never open an unlabeled PR.
4. **Log completed work in `BACKLOG.md`** once a task is done (merged or
   ready for review) — see that file for the format.

## Repo Structure

GitHub issue tracking uses native sub-issues: each `[EPIC]` issue has its
sub-issues linked both via GitHub's sub-issue relation and a `Parent Epic:
#N` line in the body. Labels and milestones (M0–M7) are set up per the
AstroCalc master spec.
