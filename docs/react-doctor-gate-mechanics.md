---
type: record
title: React Doctor Gate Mechanics
description: Dated record of why the React Doctor diff gate runs degraded and what the superseded reactDoctorFullScanTriageStatusBase.scanSha re-pin contract cost, including the consistency check the current contract makes available as a PR gate.
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

## Why The Diff Gate Runs Degraded

Measured 2026-09-09 in this repository: every `--scope changed` run degrades, on a linked
worktree, against `origin/main`, an explicit SHA, or `git merge-base`, and with the flags
stripped back to `--scope changed --base <ref>`. `--help` documents no baseline option, so the
comparison is internal and the cause is not reachable from the CLI surface.

react-doctor's own report schema documents the state as "a `baseline` run was intended but the
base couldn't be resolved — a shallow CI checkout with no merge base, or a failed base/head
lint", and the wrapper names the missing comparison rather than a cause, because the flag is
computed from `baselineDelta === undefined` and both listed causes land there
indistinguishably.

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
