---
type: runbook
title: Start a release from GitHub Actions
description: Guarded Actions release entry point and recovery decisions.
resource: urn:ultra-rss-reader:docs:release-actions-start
tags: [category/release, audience/maintainer, environment/ci]
timestamp: 2026-10-03
audience: maintainer
owner: project-maintainers
---

# Start a release from GitHub Actions

This manual entry point prepares a draft and starts the existing release build.
It does not publish the release or replace signing and artifact verification.

## Inputs and prerequisites

Repository connector access, clone access, Git push authentication, and `gh`
authentication are separate capabilities. This route uses authorized repository
changes and the authenticated GitHub UI without local CLI credentials. The
parent owns mutations; workers may only inspect, draft, review, or observe.

Prepare the five version owners with `scripts/release/bump-version.ts` in an
available workspace and review the version/CHANGELOG diff in a PR. Do not
hand-edit around a failed version check. Record local checks actually run;
unavailable checks are not passes. Keep the applicable manual checks from
[release-manual-verification.md](./release-manual-verification.md). Any explicit
exception applies only to the named release/checks, not future releases.

1. Merge the approved version and changelog changes into `main`.
2. Wait for the latest `ci.yml` push run on that exact main commit to succeed.
3. Run **Start Release** from the `main` branch with:
   - `release_tag`: the stable tag matching all five version owners, e.g. `v0.64.4`
   - `expected_sha`: the full 40-character main commit SHA you reviewed

The starter verifies the checkout, current remote main, versions, changelog,
and exact-SHA main CI before writing. It creates an annotated tag and an asset-empty
draft whose body is the reviewed CHANGELOG version section, then explicitly
dispatches `release.yml` with the tag as its ref.
This explicit dispatch is necessary because tag writes made with `GITHUB_TOKEN`
do not trigger another push workflow.

The starter uses only the job-scoped `GITHUB_TOKEN` with `contents: write` and
`actions: write`. No PAT or additional signing secret is required. Signing
secrets remain in the existing release build. Its preflight job has
`actions: read` to reject an earlier release run for the same commit under the
existing per-tag concurrency lock. All build dispatches must select the tag
as their workflow ref; `main` is only allowed for validation-only asset recovery.

## Verification and publication

The job summary records the tag, commit, draft URL, and matching release run.
A successful starter means the build was dispatched, not that release assets
are ready. Follow the [release verification checklist](./release-manual-verification.md)
before publishing the draft. Verify the release run has the exact
tag and SHA, all required builds succeeded, and signatures, updater metadata,
checksums, provenance, and expected platform assets are correct.

Keep the annotated tag object SHA distinct from its peeled source commit.
Verify the original build run's `head_sha`, `head_branch`, event, attempt, and
required job conclusions rather than choosing an unrelated latest run. A
starter, dry run, or inventory-only recovery is not evidence of build success.
Compare actual assets with `scripts/release/artifacts.ts`, not count alone.
Inventory checks do not independently verify cryptographic signatures or
recompute artifact digests; describe the evidence and skipped checks accurately.

When publication is authorized and required checks are satisfied, the parent
uses the authenticated GitHub Release UI or existing `gh` credentials to
publish. Confirm tag, notes, assets, stable/prerelease and latest settings,
then re-read the published Release to verify them. Report the release URL,
source SHA, original build run URL/conclusion, artifact summary, and any
release-specific exceptions. Publishing stable `latest.json` enables the
existing updater distribution path.

## Failure and recovery

- A changed main commit or unsuccessful CI stops without releasing that commit.
- An existing lightweight tag or a tag pointing elsewhere is never overwritten.
- A matching annotated tag with no draft or release run can be reused.
- Any existing draft/published Release or release run for the SHA stops the
  starter. This intentionally includes dry runs and failed/cancelled runs.
- An uncertain dispatch leaves the draft intact. First inspect Actions for the
  exact tag and commit. If a run exists, follow that run instead of dispatching
  another. If no run exists and the draft is empty, dispatch the existing
  **Release** workflow once with its ref and `release_tag` both set to the tag.
- If the original run failed before any upload, explicitly **Re-run all jobs**
  on that original run ID after fixing the cause. A different run ID for the
  commit is rejected. Re-running only failed/individual jobs is rejected before
  build/upload because it would reuse a preflight from a previous run attempt.
- If partial assets exist, inspect every asset against the original run before
  removing incomplete output. Only after deliberate cleanup and confirming the
  draft is empty may the original run ID be rerun. No automatic cleanup occurs;
  asset removal requires a deliberate, authorized cleanup decision.
- If all assets exist, use **Release** with `reuse_existing_assets=true` and `dry_run=false` to
  validate the unpublished draft without rebuilding or uploading. Follow the
  [provenance and signing checklist](./release-manual-verification.md) before
  publication. The workflow ref may be the tag or `main` only for this
  validation-only route. Preserve the original build evidence: recovery checks
  inventory/metadata, not cryptographic validity or original build success.
  A published release is never a recovery target. Never delete/recreate a tag
  merely to restart a release.

## Verified first release

The Actions route published [v0.64.4](https://github.com/jey3dayo/ultra-rss-reader/releases/tag/v0.64.4)
on 2026-10-03. [Starter run 37111633285](https://github.com/jey3dayo/ultra-rss-reader/actions/runs/37111633285)
and [build run 37111654823](https://github.com/jey3dayo/ultra-rss-reader/actions/runs/37111654823)
used commit `303a7c5da2a9b1b16aab07e8816392c636272be0`. Publication and all
16 expected assets were verified. This is execution evidence, not a waiver of
future gates. Manual packaged checks were explicitly waived for that release;
macOS used existing ad-hoc signing without notarization, and offline Cargo-tree
contamination verification was skipped while static checks passed.
