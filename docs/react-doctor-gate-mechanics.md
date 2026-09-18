---
type: record
title: React Doctor Gate Mechanics
description: Dated record of why the React Doctor diff gate runs degraded and why the reactDoctorFullScanTriageStatusBase.scanSha re-pin contract is enforced by review, including the gate shapes evaluated and the rejected contract change.
resource: urn:ultra-rss-reader:docs:react-doctor-gate-mechanics
tags: [category/quality, audience/agent, audience/developer, status/historical]
timestamp: 2026-09-18
audience: agent, developer
owner: project-maintainers
---

# React Doctor Gate Mechanics

Measurement and decision record behind two React Doctor gate behaviors. The durable rules live in
[../.claude/rules/quality-policy.md](../.claude/rules/quality-policy.md); this file holds the
evidence and the options that were evaluated and not adopted.

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

## scanSha Re-Pin Gating Options

Today review is what enforces the re-pin follow-up, and it has caught it twice: #313 after the
second wave, then #319 after #318, where both bot reviewers flagged the same line. Both times
the mismatch reached a merged commit first. What follows is where a gate can and cannot replace
that, measured on 2026-09-18.

**A gate on the re-pin PR itself cannot work.** The scan runs on the tree *before* the pin is
updated, so the measurement commit's own copy of the rule still asserts the previous totals.
A check strong enough to catch that mismatch fails the first of the two commits the contract
requires — the one that has to be pushed and merged before the second can name its SHA. Do not
add one to `lint`, `test:unit:ci`, or a lefthook job for this reason, not because the invariant
is unverifiable.

**A post-merge or scheduled check can work, and history is not the obstacle.** The CI test jobs
have no history to read — `ci.yml` sets no `fetch-depth`, so `actions/checkout` takes one commit
— but that is a property of where a check is placed, not of the invariant. A job can fetch what
it needs from the same default checkout, and this repository already does:
`scripts/release/validate-source.ts:60-61` runs
`git fetch --force origin main:refs/remotes/origin/main` and then asserts reachability with
`git merge-base --is-ancestor ... refs/remotes/origin/main` at `:81`. A check on `main` after the
merge can fetch `scanSha`, read that commit's copy of the pinned block, and compare it with the
current one — catching a forgotten follow-up before it survives to a release, without blocking
the baseline PR and without changing the field's contract. Not built yet; that pattern is the
shape to build it with.

A contract change would remove the need for the follow-up rather than detect it. Naming the
field for what a measurement snapshot is — the commit the scan was **run against** — is true at
the measurement commit immediately and needs one PR instead of two. What it gives up is the rule
file agreeing with its own past copy; the pinned scan totals still reproduce at that commit,
because the scan reads the source tree and not these constants. Not adopted, and recorded so the
tradeoff is not re-derived from scratch: it is a weaker guarantee than the current one, and the
current one is what the two reviews above were enforcing.
