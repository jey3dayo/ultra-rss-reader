---
type: record
title: React Doctor Gate Mechanics
description: Dated record of when the React Doctor diff gate degrades and what the superseded reactDoctorFullScanTriageStatusBase.scanSha re-pin contract cost, including the consistency check the current contract makes available as a PR gate.
resource: urn:ultra-rss-reader:docs:react-doctor-gate-mechanics
tags: [category/quality, audience/agent, audience/developer, status/historical]
timestamp: 2026-09-18
audience: agent, developer
owner: project-maintainers
---

# React Doctor Gate Mechanics

Measurement and decision record behind two React Doctor gate behaviors. The durable rules live in
[../.claude/rules/react-doctor-triage.md](../.claude/rules/react-doctor-triage.md); this file holds the
evidence behind them and the readings they replaced.

## When The Diff Gate Degrades

Superseded on 2026-10-29. An earlier measurement (2026-09-09) recorded that every `--scope changed`
run degraded, on a linked worktree, against `origin/main`, an explicit SHA, or `git merge-base`,
and concluded the cause was not reachable from the CLI. Re-measured on react-doctor 0.9.18 against
isolated fixtures and this repository, that no longer holds.

`baselineDegraded` is `baselineIntended && !baselineComputed`. A project has a `baselineDelta`
only when a base comparison was built and head and base lint both completed, so any missing
`baselineDelta` degrades the whole run.

| State | Report |
| --- | --- |
| Full clone, base given as SHA or `origin/main` | `mode: "baseline"`, not degraded |
| Depth-2 clone of a PR merge commit, base as full SHA | `mode: "baseline"`, not degraded |
| Linked worktree and main checkout of this repository | `mode: "baseline"`, not degraded |
| Unmerged paths in the working tree | `mode: "diff"`, `baselineDegraded: true`, no error |
| Shallow clone with no merge base | `mode: "full"`, every finding, no flag |
| `--base` ref missing or not a plain ref (`HEAD^1`) | `ok: false`, not a degrade |

The unmerged-path case comes from react-doctor refusing to build a diff plan while
`git diff --diff-filter=U` lists files. The shallow case is a silent fallback to a full scan, which the
wrapper's mode check reports as `mode drift`.

Not reproduced: the degraded run Issue #431 saw in CI, and the code paths for a failed head or base
lint and base files that cannot be extracted. A `--max-duration` expiry on a cold cache was
reproduced afterwards and is covered below. The fixtures were local clones; no GitHub Actions run
was observed.

## What The Wrapper Does With A Degraded Run

`baselineDegraded: true` means a baseline run was intended and no comparison was produced, so the
report lists every finding in the changed files and its counts look like a delta but are not one.
`quality:react-doctor:diff` runs the wrapper with `failOnDrift` set (`scripts/quality-baseline.ts`),
locally and anywhere else it is invoked; on a degraded report it prints a distinct failure naming the
missing comparison and exits 1, instead of passing on counts that cannot be trusted. Without
`failOnDrift` it only prints the notice.

Two causes are reproduced on react-doctor 0.9.18 (0.9.17 behaves the same):

- Unmerged paths in the working tree, for example in the middle of a merge.
- A `--max-duration` budget expiring on a cold cache.

The failure message lists both as possibilities, since the report does not say which one happened.
The wrapper passes no `--max-duration` itself.

`REACT_DOCTOR_DIFF_BASE` overrides the `--base` value; unset, it stays `origin/main`, and a set but
empty value is an error. A shallow PR merge-ref checkout has no `origin/main`, and react-doctor
rejects `HEAD^1` passed as a string, so the healthy invocation observed on a local fixture is:

```sh
# actions/checkout with fetch-depth: 2
REACT_DOCTOR_DIFF_BASE="$(git rev-parse HEAD^1)" mise run quality:react-doctor:diff
```

Without a resolvable base the run does not degrade; it falls back to `mode: "full"`, which the
wrapper already fails as `mode drift`.

The diff gate runs for frontend pull requests and is required by Quality Gate. The job verifies the
merge base and logs the report mode, degradation flag, and base SHA. The fixtures were local clones.

PR run evidence: TBD

## scanSha Re-Pin Gating: What The Old Contract Cost

Superseded on 2026-09-18. `react-doctor-triage.md` now defines `scanSha` as the tree the scan ran
against; this section records the reading it replaced, what that reading cost, and the check the
new contract makes available.

### The reading this replaced

It required `scanSha` to name a commit where every number in the pin block was already true. That
is unsatisfiable inside the PR that changes those numbers: the SHA has to be reachable from `main`,
and the values are introduced by the commit doing the pinning, so splitting the PR does not break
the cycle either.

It was not unsatisfiable in every case. A *pure* re-point follow-up, changing only the SHA, can
name a merge commit that already carries the new values. The precise claim is that a post-merge
follow-up became structurally necessary every time a snapshot or classification value moved — not
that the contract could never be met at all.

It also only ever held under a non-recursive reading. If `scanSha` itself counts as one of "every
number in this block", no commit can assert its own SHA, so even a pure re-point is impossible.
The old operation therefore depended on excluding `scanSha` from its own comparison, an exemption
nobody had written down.

### What it cost

Three follow-up PRs: #313 after the second wave, #319 after #318, and a third on #323. Each time a
reviewer, not a test, is what caught the gap, and each time the mismatch had already reached a
merged commit.

### The check the new contract allows

Under the old reading a gate on the re-pin PR could not work, because the scan runs on the tree
*before* the pin is updated. Under the new one nothing in the check depends on a commit that does
not exist yet, so it can sit on the PR rather than in a post-merge job.

History is not the obstacle either. The CI test jobs have no history to read — `ci.yml` sets no
`fetch-depth`, so `actions/checkout` takes one commit — but that is a property of where a check is
placed. This repository already fetches what it needs from the same default checkout:
`scripts/release/validate-source.ts:60-61` runs
`git fetch --force origin main:refs/remotes/origin/main` and asserts reachability with
`git merge-base --is-ancestor ... refs/remotes/origin/main` at `:81`.

The check, not built yet:

- fetch `origin/main`, resolve `scanSha` to a commit, assert it is an ancestor;
- re-run `scanCommand` and `auditScanCommand` against that tree at the pinned `pluginVersion` and
  lockfile, and compare the totals and `auditWarningCount`;
- compare the diagnostic identity set — rule plus path plus a stable location key — against the
  current classification records, because equal totals can hide one finding swapped for another,
  and from that verify `classifiedFindingCount`, each `classifiedWarningFamilies` count,
  `pendingJudgmentWarningFamilies`, and the derived `untriagedWarningCountAtScan`.

Do not compare the `scanSha` commit's own copy of the pin block with the current one. Dropping that
comparison is what the new contract does.

### Provenance

The contract change was recommended by an independent review (Codex `gpt-5.6-sol`) reading
`5b90fbc20`, the state *before* contract B was implemented. That review is advisory on the design
choice and is not an approval of the implementation in `4f7e51386`, which carries its own review.
