#!/usr/bin/env python3
"""
AstroCalc local task runner.

Pulls open GitHub issues (read-only, via `gh`), asks a "boss" model
(Opus 4.8) to pick the cheapest Claude model sufficient for each task, runs
Claude Code headlessly with that model to implement the task on a local
branch, then — by default — pushes, opens a labeled PR, and auto-merges it
if an independent review gate approves. Use --local-only to fall back to
"stop after the local commit" behavior instead.

Full-auto mode's safety gate, run AFTER the coding agent finishes (not by
the same agent/session that wrote the code):
  1. check_tests()   -- if the repo has a discoverable test command, it must
                         pass. No test command found yet => this check is
                         skipped (logged), not treated as a pass.
  2. review_diff()    -- a SEPARATE Opus call (no tools, can't be fooled by
                         the executor's own tool calls) reviews the actual
                         `git diff` against the issue's acceptance criteria
                         and returns approve/reject + reason.
Only if both gates clear does the *script* (not the LLM) run git push / gh
pr create / gh pr merge -- the coding agent itself never gets push/PR tools
(see DISALLOWED_EXECUTOR_TOOLS), so it cannot merge its own unreviewed work
even if it tried.

WARNING: this is real, consequential automation.
  - The execution step runs Claude Code with `--permission-mode
    bypassPermissions` -- file edits and shell commands run with no human
    approving each one.
  - In full-auto mode (the default), passing review means code lands on
    `main` with NO human review, because this repo currently has no test
    suite/CI -- "no problems found" mostly reflects one LLM's read of the
    diff, not a guarantee of correctness.
  - Start with --dry-run, then --local-only --issue <N> to see the code
    before it can ever reach main, before trusting full-auto on real work.

Usage:
    python automation/task_runner.py --list
    python automation/task_runner.py --dry-run --limit 3
    python automation/task_runner.py --local-only --issue 12 --yes
    python automation/task_runner.py --issue 12 --yes          # full auto: push+PR+merge if approved
    python automation/task_runner.py --limit 2 --yes
    python automation/task_runner.py --milestone "M1 — Auth + Basic Calculations (MVP)" --yes

No third-party dependencies -- stdlib only.
"""

import argparse
import datetime
import json
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
STATE_DIR = REPO_ROOT / ".automation"
STATE_FILE = STATE_DIR / "state.json"
LOG_FILE = STATE_DIR / "run.log"

BOSS_MODEL = "opus"  # Claude Opus 4.8 -- model-choice AND merge-review decisions
EXECUTOR_MODELS = {"haiku", "sonnet", "opus"}  # what the boss may pick from

# The coding agent never gets these, in either mode -- push/PR/merge is
# always performed by this script after its own review gate, never
# delegated to the LLM that wrote the code.
DISALLOWED_EXECUTOR_TOOLS = [
    "Bash(git push*)",
    "Bash(gh pr *)",
]

LABEL_TO_BRANCH_TYPE = {
    "bug": "fix",
    "documentation": "docs",
    "chore": "chore",
}


def log(msg):
    stamp = datetime.datetime.now().isoformat(timespec="seconds")
    line = f"[{stamp}] {msg}"
    print(line)
    STATE_DIR.mkdir(exist_ok=True)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def sh(cmd, cwd=REPO_ROOT, check=True, capture=True):
    result = subprocess.run(
        cmd, cwd=cwd, text=True,
        capture_output=capture, encoding="utf-8", errors="replace",
    )
    if check and result.returncode != 0:
        raise RuntimeError(
            f"Command failed ({result.returncode}): {' '.join(cmd)}\n"
            f"stdout: {result.stdout}\nstderr: {result.stderr}"
        )
    return result


def load_state():
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {}


def save_state(state):
    STATE_DIR.mkdir(exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def slugify(title, max_len=40):
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", title.lower()).strip("-")
    return slug[:max_len].rstrip("-")


def branch_type_for(labels):
    for name in labels:
        if name in LABEL_TO_BRANCH_TYPE:
            return LABEL_TO_BRANCH_TYPE[name]
    return "feat"


# --- prioritization -----------------------------------------------------
# Heuristic, not a real dependency graph: we don't reliably resolve which
# other issue a prose "## Dependencies" reference points to. What we DO do:
# earlier milestones first, explicit priority labels first, issues that
# declare no dependencies bumped up (more likely ready to start right now),
# then oldest-first as a stable tiebreaker (lower issue numbers were
# generally filed as more foundational sub-issues within their epic).

MILESTONE_RANK_RE = re.compile(r"^M(\d+)")
PRIORITY_RANK = {"p0": 0, "p1": 1, "p2": 2}
JUDGMENT_LABELS = {"needs-research", "needs-design"}  # needs a human call, not great for unattended auto-pick


def milestone_rank(issue):
    ms = issue.get("milestone")
    if not ms:
        return 99
    match = MILESTONE_RANK_RE.match(ms.get("title", ""))
    return int(match.group(1)) if match else 99


def priority_rank(labels):
    for name in labels:
        if name in PRIORITY_RANK:
            return PRIORITY_RANK[name]
    return 9


def has_no_dependencies(body):
    if not body:
        return False
    match = re.search(r"##\s*Dependencies\s*\n+(.+?)(\n##|\Z)", body, re.DOTALL | re.IGNORECASE)
    if not match:
        return False
    text = match.group(1).strip().lower()
    return text.startswith("none") or text.startswith("yoxdur")


def sort_key(issue):
    labels = [l["name"] for l in issue.get("labels", [])]
    return (
        milestone_rank(issue),
        priority_rank(labels),
        0 if has_no_dependencies(issue.get("body")) else 1,
        issue["number"],
    )


def fetch_candidate_issues(limit, milestone=None, label=None, only_issue=None, include_judgment=False):
    cmd = [
        "gh", "issue", "list", "--state", "open",
        "--json", "number,title,body,labels,milestone",
        "--limit", "200",
    ]
    if milestone:
        cmd += ["--milestone", milestone]
    if label:
        cmd += ["--label", label]
    result = sh(cmd)
    issues = json.loads(result.stdout)

    state = load_state()
    eligible = []
    for issue in issues:
        labels = [l["name"] for l in issue.get("labels", [])]
        if only_issue is not None:
            if issue["number"] != only_issue:
                continue
        else:
            if "epic" in labels:
                continue  # epics are containers, not directly actionable
            if not include_judgment and (JUDGMENT_LABELS & set(labels)):
                continue  # needs a human decision -- skip in auto batch mode
            done_states = {"done", "in_progress", "merged"}
            if str(issue["number"]) in state and state[str(issue["number"])].get("status") in done_states:
                continue
        eligible.append(issue)

    if only_issue is not None:
        return eligible
    eligible.sort(key=sort_key)
    return eligible[:limit]


def run_claude(prompt, model, tools=None, disallowed_tools=None,
                permission_mode=None, output_format="text",
                max_budget_usd=None, timeout=1200):
    # Prompt goes via stdin, not argv: avoids Windows cmd.exe's ~8191-char
    # command-line limit and argv quoting/encoding mangling for long,
    # unicode-rich prompts (issue bodies with em-dashes, backticks, etc).
    cmd = ["claude", "-p", "--model", model]
    if tools is not None:
        cmd += ["--tools", tools]
    if disallowed_tools:
        cmd += ["--disallowedTools", *disallowed_tools]
    if permission_mode:
        cmd += ["--permission-mode", permission_mode]
    if output_format:
        cmd += ["--output-format", output_format]
    if max_budget_usd is not None:
        cmd += ["--max-budget-usd", str(max_budget_usd)]

    result = subprocess.run(
        cmd, cwd=REPO_ROOT, input=prompt, text=True, capture_output=True,
        encoding="utf-8", errors="replace", timeout=timeout,
        shell=(sys.platform == "win32"),  # npm installs `claude` as a .cmd shim on Windows
    )
    return result


def extract_json(text):
    match = re.search(r"\{.*\}", text.strip(), re.DOTALL)
    return json.loads(match.group(0)) if match else {}


def plan_model(issue):
    """Boss call (Opus 4.8, no tools) -- decides which model executes this task."""
    labels = ", ".join(l["name"] for l in issue.get("labels", []))
    prompt = f"""You are the planning/"boss" model for an automated task runner.
Decide which Claude model should EXECUTE the implementation work for the
GitHub issue below, optimizing for the cheapest model that can still do the
job correctly.

Options:
- "haiku": trivial, mechanical, low-ambiguity work (e.g. pure formatting,
  a single well-specified config change).
- "sonnet": the default for most feature/fix/test implementation work.
- "opus": genuinely complex, ambiguous, or high-stakes-correctness work
  (e.g. an algorithm with subtle edge cases, an architectural decision with
  real trade-offs).

Issue #{issue['number']}: {issue['title']}
Labels: {labels}

{issue.get('body') or '(no body)'}

Respond with ONLY a JSON object, no prose, no markdown fences:
{{"model": "haiku" | "sonnet" | "opus", "reason": "<one sentence>"}}"""

    try:
        result = run_claude(
            prompt, model=BOSS_MODEL, tools="", output_format="text",
            max_budget_usd=0.50, timeout=120,
        )
        decision = extract_json(result.stdout)
        model = decision.get("model")
        if model in EXECUTOR_MODELS:
            return model, decision.get("reason", "")
    except Exception as e:
        log(f"  boss planning failed ({e}), defaulting to sonnet")
    return "sonnet", "fallback default (boss call failed or returned unparseable output)"


def execute_task(issue, model, branch, max_budget_usd, timeout):
    prompt = f"""You are implementing GitHub issue #{issue['number']} in this
repository, on the local branch `{branch}` (already created from an
up-to-date main -- do not switch or create a different branch).

Issue: {issue['title']}

{issue.get('body') or '(no body)'}

Implement this issue's acceptance criteria as completely as you reasonably
can. When done, commit your work locally with a Conventional Commits
message (feat:/fix:/chore:/docs:/refactor:/test: prefix) that references
"Refs #{issue['number']}" in the body.

Hard constraints:
- Do NOT run `git push`, `gh pr create`, or anything else that publishes to
  GitHub -- you don't have those tools, and a separate process handles
  publishing after independent review.
- If the task is too large or ambiguous to finish completely, implement as
  much as you can verify is correct, commit that, and end your final
  message with a clear "Remaining work:" note.
- Follow the conventions in CLAUDE.md and CONTRIBUTING.md.
"""
    return run_claude(
        prompt, model=model,
        disallowed_tools=DISALLOWED_EXECUTOR_TOOLS,
        permission_mode="bypassPermissions",
        output_format="text",
        max_budget_usd=max_budget_usd,
        timeout=timeout,
    )


def check_tests():
    """Best-effort test run. Returns (status, detail) where status is one of
    "passed", "failed", "skipped" (no discoverable test command yet)."""
    pkg = REPO_ROOT / "package.json"
    if pkg.exists():
        try:
            scripts = json.loads(pkg.read_text(encoding="utf-8")).get("scripts", {})
        except Exception:
            scripts = {}
        if "test" in scripts and "no test specified" not in scripts["test"]:
            result = sh(["npm", "test", "--silent"], check=False)
            if result.returncode == 0:
                return "passed", "npm test"
            return "failed", (result.stdout + result.stderr)[-1000:]
    return "skipped", "no discoverable test command (no package.json test script)"


def review_diff(issue, branch):
    """Independent Opus call (no tools) reviewing the actual diff -- the
    merge gate. Runs in a fresh call, separate from the session that wrote
    the code, so it isn't just the executor grading its own homework."""
    diff = sh(["git", "diff", f"main...{branch}"], check=False).stdout
    if not diff.strip():
        return {"verdict": "reject", "reason": "empty diff -- nothing was committed"}

    prompt = f"""You are an independent reviewer gating whether a change is
safe to auto-merge to `main` with NO human review (this repo currently has
no CI/test suite, so you are the only check).

Issue #{issue['number']}: {issue['title']}
Acceptance criteria / description:
{issue.get('body') or '(no body)'}

Full diff of the proposed change:
```diff
{diff[:12000]}
```

Reject if: the diff doesn't plausibly satisfy the acceptance criteria, it
looks incomplete/broken, it touches things unrelated to the issue, it does
something a careful human reviewer would flag (security issue, destructive
change, secrets committed, etc), or you're genuinely unsure. Default to
reject when uncertain -- the cost of a false reject is small (stays local
for human review), the cost of a false approve is a bad merge to main.

Respond with ONLY a JSON object, no prose, no markdown fences:
{{"verdict": "approve" | "reject", "reason": "<one or two sentences>"}}"""

    try:
        result = run_claude(
            prompt, model=BOSS_MODEL, tools="", output_format="text",
            max_budget_usd=0.75, timeout=180,
        )
        decision = extract_json(result.stdout)
        if decision.get("verdict") in ("approve", "reject"):
            return decision
    except Exception as e:
        return {"verdict": "reject", "reason": f"review call failed: {e}"}
    return {"verdict": "reject", "reason": "review call returned unparseable output"}


def publish_and_merge(issue, branch, labels):
    """Runs as plain git/gh commands from THIS script -- not agent tool
    calls -- so the coding agent is never the one deciding to publish."""
    sh(["git", "push", "-u", "origin", branch])
    label_arg = ",".join(labels) if labels else None
    cmd = [
        "gh", "pr", "create",
        "--title", issue["title"],
        "--body", f"Automated implementation of #{issue['number']}.\n\nCloses #{issue['number']}\n\n🤖 Generated with Claude Code automation (task_runner.py), reviewed and auto-merged after passing the review gate.",
    ]
    if label_arg:
        cmd += ["--label", label_arg]
    pr_url = sh(cmd).stdout.strip()
    pr_number = pr_url.rstrip("/").split("/")[-1]
    sh(["gh", "pr", "merge", pr_number, "--squash", "--delete-branch"])
    return pr_url


def run_one_task(issue, args, state):
    num = issue["number"]
    labels = [l["name"] for l in issue.get("labels", [])]
    log(f"--- Issue #{num}: {issue['title']} ---")

    model, reason = plan_model(issue)
    log(f"  boss picked model={model} ({reason})")

    if args.dry_run:
        log(f"  [dry-run] would branch, run executor model={model}, and stop here")
        return

    sh(["git", "checkout", "main"])
    sh(["git", "pull", "origin", "main"])

    btype = branch_type_for(labels)
    branch = f"{btype}/{num}-{slugify(issue['title'])}"
    log(f"  branch: {branch}")
    sh(["git", "checkout", "-b", branch])

    state[str(num)] = {
        "status": "in_progress", "model": model, "branch": branch,
        "started": datetime.datetime.now().isoformat(timespec="seconds"),
    }
    save_state(state)

    try:
        result = execute_task(issue, model, branch, args.max_budget_usd, args.timeout)
        log(f"  executor exit={result.returncode}")
        tail = (result.stdout or "")[-1500:]
        log(f"  executor output (tail):\n{tail}")
        commit = sh(["git", "rev-parse", "--short", "HEAD"], check=False).stdout.strip()
        base_record = {
            **state[str(num)], "commit": commit,
            "finished": datetime.datetime.now().isoformat(timespec="seconds"),
        }

        if result.returncode != 0:
            state[str(num)] = {**base_record, "status": "failed", "error": "executor nonzero exit"}
        elif args.local_only:
            state[str(num)] = {**base_record, "status": "done"}
            log("  --local-only: stopping after local commit, not pushing")
        else:
            test_status, test_detail = check_tests()
            log(f"  tests: {test_status} ({test_detail[:200]})")
            review = review_diff(issue, branch)
            log(f"  review verdict={review.get('verdict')} reason={review.get('reason')}")

            if test_status == "failed":
                state[str(num)] = {**base_record, "status": "local-only-needs-review",
                                    "reason": f"tests failed: {test_detail[:500]}"}
            elif review.get("verdict") != "approve":
                state[str(num)] = {**base_record, "status": "local-only-needs-review",
                                    "reason": review.get("reason")}
            else:
                pr_url = publish_and_merge(issue, branch, labels)
                log(f"  merged: {pr_url}")
                state[str(num)] = {**base_record, "status": "merged", "pr_url": pr_url}
    except subprocess.TimeoutExpired:
        log(f"  executor TIMED OUT after {args.timeout}s")
        state[str(num)] = {**state[str(num)], "status": "failed", "error": "timeout"}
    except Exception as e:
        log(f"  task errored: {e}")
        state[str(num)] = {**state[str(num)], "status": "failed", "error": str(e)}
    finally:
        save_state(state)
        sh(["git", "checkout", "main"], check=False)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--list", action="store_true", help="list candidate issues and exit")
    parser.add_argument("--dry-run", action="store_true", help="plan (boss decision) only, don't touch git or execute")
    parser.add_argument("--local-only", action="store_true", help="stop after the local commit -- no test/review gate, no push, no PR, no merge")
    parser.add_argument("--issue", type=int, default=None, help="run a specific issue number, ignoring the done/in-progress filter")
    parser.add_argument("--limit", type=int, default=1, help="max number of issues to process this run (default 1)")
    parser.add_argument("--milestone", default=None, help="filter candidate issues by milestone title")
    parser.add_argument("--label", default=None, help="filter candidate issues by label")
    parser.add_argument("--include-needs-research", action="store_true", help="also auto-pick issues labeled needs-research/needs-design (normally skipped in batch mode -- they usually need a human decision)")
    parser.add_argument("--max-budget-usd", type=float, default=3.0, help="per-task spend cap passed to claude -p (default 3.0)")
    parser.add_argument("--timeout", type=int, default=1200, help="per-task timeout in seconds (default 1200 = 20 min)")
    parser.add_argument("--yes", action="store_true", help="skip the confirmation prompt")
    args = parser.parse_args()

    issues = fetch_candidate_issues(args.limit, args.milestone, args.label, args.issue, args.include_needs_research)

    if args.list or not issues:
        if not issues:
            log("No candidate issues found (already done/in-progress/merged, or filters too narrow).")
        else:
            log(f"{len(issues)} candidate issue(s):")
            for i in issues:
                labels = ", ".join(l["name"] for l in i.get("labels", []))
                log(f"  #{i['number']}: {i['title']}  [{labels}]")
        if args.list:
            return

    if not args.dry_run and not args.yes:
        mode = "local commit only (--local-only)" if args.local_only else \
            "FULL AUTO -- will push, open a PR, and auto-merge to main if the review gate approves"
        print(
            f"\nAbout to run {len(issues)} task(s) with bypassPermissions "
            f"(unattended file/shell access). Mode: {mode}.\n"
            f"Type 'yes' to continue: ", end=""
        )
        if input().strip().lower() != "yes":
            log("Aborted by user.")
            return

    state = load_state()
    for issue in issues:
        run_one_task(issue, args, state)

    log("Run complete. Check .automation/state.json for per-issue outcomes (merged / local-only-needs-review / failed).")


if __name__ == "__main__":
    main()
