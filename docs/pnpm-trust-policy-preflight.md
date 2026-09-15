---
type: record
title: pnpm trustPolicy Adoption Preflight
description: Measured evidence for the 2026-09-10 pnpm `trustPolicy: no-downgrade` adoption decision.
resource: urn:ultra-rss-reader:docs:pnpm-trust-policy-preflight
tags: [category/documentation, audience/agent, audience/developer]
timestamp: 2026-09-10
audience: agent, developer
owner: project-maintainers
---

# pnpm trustPolicy Adoption Preflight (2026-09-10)

Measured evidence behind the adoption decision recorded in
[../.claude/rules/quality-policy.md](../.claude/rules/quality-policy.md) (Supply Chain Hardening
Findings). The decision, the current `trustPolicyExclude` entries, and their review dates live in
that rule; this page holds only the reproduction log. The scratch and fixture trees it names lived
under `/private/tmp` and are gone - the commands are what reproduces them.

## Evidence

- Environment: pnpm `12.3.4` on macOS. `package.json` declares both `packageManager: pnpm@12.3.4`
  and `engines.pnpm: 12.3.4`. A scratch directory was created at
  `/private/tmp/trustpolicy-scratch-<run>`; it contains copies of the current
  `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml`. Only the scratch
  `pnpm-workspace.yaml` was changed, adding `trustPolicy: no-downgrade`; the source
  worktree manifest and lockfile were not edited. The install used the scratch-only store
  `/private/tmp/trustpolicy-store-<run>` and state directory
  `/private/tmp/trustpolicy-state-<run>`.
- Current manifest and lockfile install:

  ```text
  COMMAND: mise exec -- pnpm --dir /private/tmp/trustpolicy-scratch-<run> install --frozen-lockfile --store-dir /private/tmp/trustpolicy-store-<run> --state-dir /private/tmp/trustpolicy-state-<run> --reporter append-only
  ? Verifying lockfile against supply-chain policies (1102 entries)...
  ✗ Lockfile failed supply-chain policy check (1102 entries in 36.4s)
  Lockfile is up to date, resolution step is skipped
  Error: ERR_PNPM_TRUST_DOWNGRADE

    × installing dependencies
    ╰─▶ 1 lockfile entries failed verification:
          semver@6.3.1 High-risk trust downgrade for "semver@6.3.1" (possible
        package takeover)
  EXIT STATUS: 1
  ```

  The rejected package was `semver@6.3.1` (one lockfile entry). The lockfile contains
  this entry transitively; it is present at `pnpm-lock.yaml:4903` and is referenced by
  Babel entries in the lockfile.
- Controlled fixture. Built from an empty directory so the comparison has exactly one
  candidate, with the lockfile written while the policy was still `off` so the failure below
  comes from the policy and not from an unresolvable tree:

  ```sh
  d=/private/tmp/trustpolicy-fixture-<run>
  mkdir -p "$d"
  printf '{"name":"trustpolicy-fixture","version":"0.0.0","private":true,"dependencies":{"semver":"6.3.1"}}\n' > "$d/package.json"
  mise exec pnpm@12.3.4 -- pnpm --dir "$d" install --lockfile-only --config.trust-policy=off
  ```

  Pin the pnpm version in `mise exec` rather than relying on a bare `mise exec -- pnpm`. The
  scratch tree is outside any repository, so a bare shim has no version to resolve and exits
  with `No version is set for shim: pnpm`; the commands below use the same pinned form for
  that reason. Verified end to end on 2026-09-10: the fixture reproduces the failure below and
  its `--config.trust-policy=off` control passes.

  The project config was then set to `trustPolicy: no-downgrade` using
  `mise exec pnpm@12.3.4 -- pnpm --dir /private/tmp/trustpolicy-fixture-<run> config set trust-policy no-downgrade --location project`.
  The policy was observed with
  `mise exec pnpm@12.3.4 -- pnpm --dir /private/tmp/trustpolicy-fixture-<run> config get trust-policy --location project`
  returning `no-downgrade`. The `--dir` is load-bearing: `--location project` reads the project
  config at the working directory, so replaying this from the repository root inspects this
  repository's `pnpm-workspace.yaml` instead and returns `undefined`.

  ```text
  COMMAND: mise exec pnpm@12.3.4 -- pnpm --dir /private/tmp/trustpolicy-fixture-<run> install --frozen-lockfile --ignore-scripts --store-dir /private/tmp/trustpolicy-fixture-store-<run> --state-dir /private/tmp/trustpolicy-fixture-state-<run> --reporter append-only
  ? Verifying lockfile against supply-chain policies (1 entry)...
  ✗ Lockfile failed supply-chain policy check (1 entry in 399ms)
  Error: ERR_PNPM_TRUST_DOWNGRADE

    × installing dependencies
    ╰─▶ 1 lockfile entries failed verification:
          semver@6.3.1 High-risk trust downgrade for "semver@6.3.1" (possible
        package takeover)
  INSTALL EXIT STATUS: 1
  ```

  As the fixture control, the unchanged lockfile installed with the CLI override
  `--config.trust-policy=off`:

  ```text
  COMMAND: mise exec pnpm@12.3.4 -- pnpm --dir /private/tmp/trustpolicy-fixture-<run> install --frozen-lockfile --ignore-scripts --config.trust-policy=off --store-dir /private/tmp/trustpolicy-fixture-store-<run> --state-dir /private/tmp/trustpolicy-fixture-state-<run> --reporter append-only
  ? Verifying lockfile against supply-chain policies (1 entry)...
  ✓ Lockfile passes supply-chain policies (1 entry in 272ms)
  Lockfile is up to date, resolution step is skipped
  Done in 298ms using pnpm v12.3.4
  CONTROL INSTALL EXIT STATUS: 0
  ```

- Primary information checked: `mise exec -- pnpm --version` returned `12.3.4`.
  `mise exec -- pnpm --help` lists `config` as the configuration command, but does not
  define the `trustPolicy` values. The official pnpm 12.x settings document
  [trustPolicy](https://pnpm.io/settings#trustpolicy) as `off | no-downgrade` (default
  `off`); it describes `no-downgrade` as failing when a package's trust level is lower
  than an earlier-published version, with checks ordered by publish date rather than
  semver. The same page gives trusted-publisher to provenance or no-evidence as examples
  of a weaker signal.
- Unconfirmed: the pnpm error does not identify the specific earlier `semver` release or
  trust evidence that caused the comparison, so that package-level comparison was not
  independently itemized. No upstream pnpm test was executed, and this preflight did not
  test other pnpm versions, registries, or platforms. The scratch and fixture trees lived
  under `/private/tmp` and are gone; the commands above are what reproduces them.
