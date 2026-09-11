# Quality Policy

React Doctor / Knip / similarity / task priority rules that are too durable for `todo.txt` or a GitHub Issue live here.

## Dependency Advisory Policy

CI runs `mise run audit:deps` (pnpm, prod paths) and `mise run audit:deps:rust` (cargo audit) in the `audit` job.

- Fail: CI fails when a high-or-above advisory hits a reachable path — any Rust dependency, or an npm dependency reachable from `--prod` scope.
- Ignore: dev/test/CLI-only-path advisories must be registered explicitly in the ignore list (`auditConfig.ignoreGhsas` in `pnpm-workspace.yaml` for npm; `.cargo/audit.toml` for Rust) with advisory ID, reason, and date recorded here. Anonymous ignores are forbidden.
- Review: ignore entries are re-triaged during release preflight.

Ignore entries:

- `RUSTSEC-2026-0235` — rkyv <0.8.17 (out-of-bounds reads in archives containing Rc/Arc) via `tauri-plugin-log -> byte-unit -> rust_decimal` as a disabled optional feature; `cargo tree -i rkyv --target all` prints nothing, so rkyv is never compiled. Remove once rust_decimal adopts rkyv >=0.8.17 or drops the feature; reviewed 2026-08-07.

Known dev-path advisories (13 findings: 4 high / 6 moderate / 3 low via jsdom→vitest, shadcn→hono, storybook→esbuild) were vetted as unreachable from the shipping Tauri app and production Vite bundle on 2026-07-14.

## pnpm Version Enforcement

Three files name the pnpm version and none of them is redundant, because three different
consumers read them: `mise.toml` `[tools].pnpm` supplies pnpm locally, `package.json`
`packageManager` is what `pnpm/setup` resolves in CI, and `package.json` `engines.pnpm` is a
fail-fast for anyone still on pnpm 11. `scripts/check-toolchain-contract.ts` pins all three to
the same value, the way it already does for Node.

`pmOnFail: ignore` in `pnpm-workspace.yaml` turns off pnpm's own `packageManager` download and
switch, because mise owns that locally. Leaving it on makes pnpm 12 write `pnpm-lock.yaml` as
two YAML documents; consumers that read only the first document then report no dependencies
(pnpm/pnpm#13805, dependabot-core#15904). GitHub's dependency graph is disabled on this
repository — verified 2026-09-09: `/network/dependencies` renders "Dependency graph is
disabled", `GET /repos/{owner}/{repo}/dependency-graph/sbom` returns 404 here while the same
token gets 200 on another public repository, and `GET .../vulnerability-alerts` reports alerts
disabled — so nothing reads it today. Keeping the lockfile single-document is about not leaving
a trap for whoever enables it. The enforced advisory gate remains `mise run audit:deps`, which
reads either shape.

Do not rely on `engines.pnpm` to stop a wrong local pnpm 12.x. Measured on 2026-09-09 across
seven install cases: pnpm 12 ignores the root project's `engines.pnpm` entirely, with or
without `pmOnFail` and with or without `engineStrict`, which contradicts pnpm's own
`package_json` documentation. pnpm 11 does enforce it, so an outdated toolchain fails fast with
`ERR_PNPM_UNSUPPORTED_ENGINE`. The residual gap is a contributor who skips mise and runs some
other pnpm 12.x; `--frozen-lockfile` catches a stale lockfile, and CI's toolchain contract
catches version drift in the manifests, but neither sees that contributor's local binary.

## Knip Ignore Policy

Knip is a report-only review tool in this repository, not a continuously enforced gate. Its unused-file detector cannot statically trace consumers routed through `mise` tasks or Vite aliases. As of 2026-09-08, all seven reported unused files were verified as false positives by locating the actual consumer of each:

| File | Consumer |
| --- | --- |
| `scripts/check-toolchain-contract.ts` | `mise/quality.toml` |
| `scripts/report-dependency-licenses.ts` | `mise/quality.toml` |
| `scripts/verify-action-pins.ts` | `mise/setup.toml` `deps:update` |
| `scripts/install-windows-app.ts` | `mise.toml` `run_windows` |
| `src/dev/prod-stubs/scenario-ids.ts` | `vite.config.ts` production alias |
| `src/dev/prod-stubs/use-dev-intent.ts` | `vite.config.ts` production alias |
| `src/dev/prod-stubs/use-resolved-dev-intent.ts` | `vite.config.ts` production alias |

The three alias targets are covered by `production-dev-aliases.node.test.ts`.

`scripts/run-guarded-pnpm-update.ts` has the same shape — invoked only from `mise/setup.toml` — but Knip does not report it, because `release-age-gate-contract.node.test.ts` imports it with `?raw` to pin its contract. That import is what makes it traceable, so do not treat its absence from the report as evidence that Knip can follow `mise` consumers.

Keeping a hard count gate in that situation encourages number-matching instead of triage and degrades the signal. Reconsider this policy if Knip can trace these `mise` and Vite alias consumers.

`package.json#knip.ignoreDependencies` entries must document why Knip cannot see a real consumer:

- `wrangler` — invoked by the `mise` `deploy:site` task from `.github/workflows/deploy-site.yml`; Knip does not trace `mise` or workflow command consumers; reviewed 2026-08-23.

`package.json#knip.ignoreBinaries` entries must document why Knip cannot trace a binary consumer:

- `mise` — launched via `spawnSync` by `scripts/similarity-report.ts` to run the Rust scan; `mise` is a toolchain runner rather than a package.json dependency and therefore cannot be declared as an npm dependency; reviewed 2026-08-29.

### Unused Export And Type Findings

Classify each `exports` / `types` finding as false-positive, accepted-risk, narrow, or remove. Decide from three checks, in this order, and record the evidence:

1. Resolve the `from "…"` specifier of every import that mentions the name. A name appearing in many files is not proof a re-export is live; those files usually import it from the owner module, which makes the re-exporting entry dead.
2. Search the tests that import source files with `?raw` for the name. Those contracts can pin the literal `export` keyword, and Knip cannot model them.
3. Check whether the name is used inside its own file. If it is, narrowing to a module-local binding is the first candidate. If its only occurrence is the definition, narrowing is impossible — `tsc --noUnusedLocals` rejects the unused local — so the choice is remove or keep, never "drop the modifier".

A mirrored Rust constant, DTO, command, or capability entry is a Rust-side contract and is not a reason to keep a TypeScript export; only a TypeScript consumer counts. Two shapes of TypeScript consumer are invisible to both Knip and an import-graph search, and both were found the hard way: a test that reads the `.rs` file as text and compares, and a test that extracts symbols from the *TypeScript* source text. `tests/helpers/tauri-mocks.node.test.ts` is the second kind — it scrapes `safeInvoke("…")` command strings out of `src/api/tauri-commands/*.ts` and pins them against the default mock set, so deleting a wrapper with no caller breaks it. Check both before deleting anything at a command or DTO boundary. "We might need it later" is not a reason either. Do not generalise the design-system barrel completeness precedent below to other barrels; check each owner for an actual pinned public surface instead.

Standing accepted risk:

- `getPlatformPermissionDeniedRecovery` (`src/api/tauri-commands/system.ts`) — no production caller, but the mock-parity test above pins it, and `src/dev/mocks.ts` plus the `debug-log-commands` capability allowlist agree with it. Retiring `get_platform_permission_denied_recovery` means retiring all five surfaces together; wiring a caller or retiring it end to end is the open decision. Reviewed 2026-09-08.

Standing false positive:

- `corePreferenceDefaults` (`src/schemas/preference-values.ts`) — `src/__tests__/schemas/preferences-schema-contract.test.ts` imports the module with `?raw` and matches `/export const corePreferenceDefaults = \{([\s\S]*?)\} as const/`. The `export` keyword is part of that contract, so the modifier must stay; reviewed 2026-09-08.

Findings already classified once are recorded per-finding in [../../docs/knip-export-classification.md](../../docs/knip-export-classification.md); check there before re-classifying a repeat hit.

Intentional public barrel completeness is pinned by public API tests rather than a file-level Knip ignore. The design-system barrel re-exports each primitive in a component family as a complete public surface, and `src/__tests__/components/ui-wrapper-public-api.node.test.ts` consumes the full Command family so an unused member such as `CommandDialog` is not removed while the other primitives remain available. The existing `src/components/ui/*` export ignores remain limited to their small wrapper files; reviewed 2026-08-29.

## Provider Policy Family

The `clock_policy`, `deletion_retention_policy`, and `optimistic_mutation_conflict_policy` methods in `src-tauri/src/domain/provider.rs` have zero production callers; tests alone pin their contracts. They are not dead code: together they form an executable specification of provider-specific behavior. Do not remove one merely because it has no production caller, since removing a single member would break the consistency of the policy family. If a future audit flags these methods as dead code, reject that finding using this documented contract.

## Task Priority Taxonomy

Tasks live in `todo.txt` (tuxedo format) with rich context in linked GitHub Issues. Priority mapping: `(A)`=P0, `(B)`=P1, `(C)`=P2, `(D)`=P3.

- `(A)` P0: release-blocking regression, data loss, security issue, or broken app start/build.
- `(B)` P1: user-visible defect or workflow break that should be fixed before the next planned release.
- `(C)` P2: quality debt with clear implementation work, test gap, or warning cleanup that can be batched safely.
- `(D)` P3: policy, taxonomy, adoption preflight, documentation, or low-risk cleanup that should prevent future drift but does not change runtime behavior by itself.

When a task becomes a durable rule, move the rule into `CLAUDE.md` or `.claude/rules/`, then close the issue and remove the `todo.txt` line after verifying the rule is discoverable.

## Task Aging

Aging is review pressure, not automatic priority mutation. The todo.txt creation date (second field) is the age reference.

- Treat a `(B)` with no review for 30 days as escalation input: either start it, split it, or explicitly downgrade with a reason recorded in the linked issue.
- Treat a `(C)` with no review for 60 days as stale triage input: refresh owner/scope/verification in the issue, merge into related work, or defer with a concrete blocker.
- Treat a `(D)` with no review for 90 days as an archive candidate unless it still prevents concrete drift through tooling, policy, or contract-test planning.
- Move completed user-visible work to `CHANGELOG.md` only after the implementation lands; archive the todo.txt line with `tuxedo done` + `archive` and close the linked issue.

## TypeScript Version Policy

`package.json` carries a single `"typescript": "^7.0.2"`. Do not add back the `@typescript/typescript6` alias or a second `typescript-7` entry unless one of the guard conditions below is tripped.

Microsoft's documented 6.0/7.0 transition pattern aliases the root `typescript` to `@typescript/typescript6` so that tools importing the compiler API keep working, because **TypeScript 7.0 ships no programmatic API** — under 7.x, `require("typescript")` exposes only `version` and `versionMajorMinor`. That guidance assumes the project has such a tool. This one does not: an audit on 2026-09-05 found no compiler-API consumer active in any gate, and dropping the alias left `mise run ci` and `mise run build:storybook` green with no peer warnings.

The audit found exactly three packages that require `typescript` at runtime, none of which execute here:

- `react-docgen-typescript` and `@joshwooding/vite-plugin-react-docgen-typescript` — loaded only when Storybook's `typescript.reactDocgen` equals `"react-docgen-typescript"`. Storybook 8.0 flipped that default to the Babel-based `react-docgen`, and `.storybook/main.ts` does not override it.
- `cosmiconfig` (via `shadcn`) — calls `typescript.transpileModule` only when loading a `.ts` config file. `shadcn` reads `components.json` and runs in no gate.

Reinstate the alias, as a paired `"typescript": "npm:@typescript/typescript6@^6.0.2"` plus a separately named TypeScript 7 entry, if any of these becomes true:

- Storybook's `typescript.reactDocgen` is set to `"react-docgen-typescript"`. The installed plugin 0.7.0 declares an open `typescript: ">= 4.3.x"`, but that range is merely stale: 0.8.0 narrowed it to `">=4.3.0 <7"` after confirming TypeScript 7 crashes it on `ts.sys`. Its TypeScript 7 backend targets 7.1 APIs and is unmerged.
- Storybook's `experimentalDocgenServer` feature is enabled. It drives the TypeScript Language Service directly and crashes under TypeScript 7 (storybookjs/storybook#35792, open).
- A `shadcn` config moves from `components.json` to a `.ts` file, or any new dependency reads the compiler API.

Before reinstating, re-check the real resolution rather than assuming: `pnpm why typescript`, then each consumer's `typescript` peer range.

The Babel-based `react-docgen` is less complete than the TypeScript-based one — Storybook documents gaps for types from external packages, enums, and `forwardRef`. Current stories do not depend on those, so the tradeoff is accepted; a props table that turns up empty is the signal to revisit it, and that revisit is what trips the first guard condition above.

## React Compiler Adoption

React Compiler is not enabled in this repository. Do not add `babel-plugin-react-compiler`, Vite compiler wiring, or compiler-driven memoization changes as incidental cleanup.

Before enabling it, create an adoption preflight that records:

- the exact React / compiler package versions and the Vite integration point;
- the focused React Doctor diff/full results before and after enabling it;
- affected memoization, effect cleanup, and hook-dependency patterns;
- the rollback path if compiler warnings or runtime behavior drift.

Compiler adoption is opt-in only. Until that preflight is accepted, keep manual memoization and effect cleanup decisions based on current React runtime behavior, not on future compiler assumptions.

## ES2023 Array Copy Methods

`Array.prototype.toSorted()` and related ES2023 copy methods may be used only after confirming the touched code runs in one of these targets:

- Node-side tests and scripts: Node 26 from `mise.toml` / `package.json` engines.
- Frontend build output: Vite build target is explicitly `es2023`.
- Tauri app WebView: current Tauri 2 platform WebViews for the supported desktop OS set; do not use ES2023 copy methods in compatibility-sensitive runtime boundaries without a focused check on the affected OS.

Prefer applying `.toSorted()` first in test-only or dev-script code. Production code changes should stay scoped to readability or mutation-safety wins, and hot-path rewrites need a focused test or profiling note. Do not add polyfills just to satisfy a React Doctor suggestion.

`js-tosorted-immutable` on a `[...x].sort()` spread is a false positive whenever `x` is a `Set` or
`Map`. The rule's message assumes the spread copies an array that `sort()` then copies again, but
for a `Set` the spread is materialization, not a redundant copy: `[...set].sort()` allocates once
and sorts in place, while `Array.from(set).toSorted()` allocates twice. Rewriting those sites makes
the code do more work, so leave them and record the reason at the call site.

The rule reports spread-sorts reached through a property access without resolving the element type.
Local `Set`s built with `.add()` in the same function use the same shape and are not reported, so a
flagged spread-sort on a property access has to be checked by hand before it is rewritten. Verified
on 2026-09-08 with `oxlint-plugin-react-doctor` 0.9.13 in `scripts/repo-contract-inventory.ts`.

## React Doctor Scan Scope

The React Doctor tasks pass `--project .` so the scan covers only this repository's own
project. Do not remove it to "scan more".

`react-doctor .` discovers every project root beneath the working directory. `apm_modules/`
holds vendored packages and is gitignored, so it exists in an ordinary checkout and is absent
from a fresh worktree. Without `--project .` the same command therefore reported different
totals depending on which tree it ran in, which repeatedly produced set comparisons between
two different trees presented as before/after of one change.

The distortion is not limited to extra files. Project-level rules fire once per discovered
project even when they point at the same file: with the vendored projects included,
`require-pnpm-hardening` was reported three times against the single root
`pnpm-workspace.yaml`, and `require-reduced-motion` was reported against a vendored
`package.json`. Measured on 2026-09-08 at `c1183e67f`, the unscoped scan reported
15 errors / 100 warnings / 67 files and the scoped scan reported 14 / 97 / 64.

Before comparing two React Doctor runs, confirm `projects[]` in the JSON report holds exactly
the repository root. A count difference between two runs is not evidence about the code until
that matches.

## React Doctor Warning Categories

Classify every React Doctor warning before suppressing or fixing it:

- `must-fix`: likely bug, regression, performance hot path, or warning introduced by the current change.
- `accepted-risk`: intentional tradeoff that remains in production code; record the reason in the nearest rule, TODO, or baseline update note.
- `false-positive`: tool cannot model the local contract; record the proof near the code only when a local comment prevents future churn.
- `suppress`: last resort for unavoidable tool noise; include the warning id, scope, reason, owner, and review trigger in the suppression location.

Suppression records belong in the narrowest durable place: local code comment for one-line false positives, `.claude/rules/` for repeated project policy, or `scripts/quality-baseline.ts` only for pinned baseline count changes. Re-run the matching pinned React Doctor task after changing suppressions or baseline counts.

### Nothing Runs React Doctor Automatically

Both React Doctor tasks are manual. Verified 2026-09-10 against the primary sources:
`.github/workflows/ci.yml` invokes `mise run quality:toolchain` and no other `quality:` task,
and `lefthook.yml` runs format, `test:unit:ci`, `lint`, `test:rust`, and `build` — neither file
mentions `react-doctor`. So "gate" below and in `CLAUDE.md` names what the task is *for*, not
something that stops a merge: a reintroduced finding reaches `main` unless a person runs the
task or an ordinary test catches it.

Two consequences. A fix for a React Doctor finding needs its own durable guard — an ordinary
test that fails when the fix is reverted — because the scan will not notice; a source-shape
contract test is the usual shape when the defect itself is not reachable from a sequential
test. And a stale `reactDoctorBaselines` pin fails nothing, so re-pinning after a fix lands has
to be tracked as work rather than assumed.

### The Diff Gate Currently Runs Degraded

`quality:react-doctor:diff` prints an extra line when react-doctor sets `baselineDegraded`:

```text
React Doctor reported no baseline comparison, so this run lists every finding in the changed files rather than only new ones.
```

react-doctor's own report schema documents that state as "a `baseline` run was intended but the
base couldn't be resolved — a shallow CI checkout with no merge base, or a failed base/head
lint", and says the report then "lists every finding in the changed files (mode downgrades to
`diff`, the `baseline` block is dropped, the CI gate is skipped)". In other words a degraded run
is the `files` behaviour again, and the counts alone cannot be told apart from a real delta —
which is why the wrapper says so out loud instead of letting the numbers stand for something
they are not. The wrapper names the missing comparison rather than a cause, because the flag is
computed from `baselineDelta === undefined` and both listed causes land there indistinguishably.

Measured 2026-09-09 in this repository: every `--scope changed` run degrades, on a linked
worktree, against `origin/main`, an explicit SHA, or `git merge-base`, and with the flags
stripped back to `--scope changed --base <ref>`. `--help` documents no baseline option, so the
comparison is internal and the cause is not reachable from the CLI surface. Do not read a green
diff gate as "no new findings" while this line appears; read it as "no findings at all in the
changed files", which is strictly stronger and therefore still safe to gate on. Finding the
cause, so the gate reports what it was changed to report, is open work.

### Recording An Accepted Risk So The Gate Can See It

`quality:react-doctor:diff` runs with `--scope changed`, so it reports only findings that are
new against `origin/main`. New means new to the scan, not worse: a finding inside a function
the change rewrote is reported even when its metrics are identical to the base. That is the
right default — rewriting a function is when to re-examine what it carries — but it means a
finding already classified as accepted risk will keep stopping the gate until the decision is
recorded somewhere the tool reads.

React Doctor has no file- or function-scoped configuration; `rules set` and `rules disable`
change a rule's severity everywhere. Turning a rule down to clear one classified finding would
hide every other instance, including ones that are genuine. So the accepted risk goes in an
inline record at the finding, which is the narrow case the repository-wide rule against inline
suppression exempts:

```ts
// react-doctor-disable-next-line <full rule id> -- accepted risk (<family>), <path to the classification record>:<line>
```

Copy the rule id exactly as the scan printed it. Not every rule carries the `react-doctor/`
prefix — `react/no-danger` in `article-content-view.tsx` is one of the existing records — and a
disable whose id does not match the reported one silently clears nothing.

The `--` reason must point at the record that holds the reasoning — the per-finding entry in
[../../docs/react-doctor-complexity-classification.md](../../docs/react-doctor-complexity-classification.md)
for complexity findings, or the owning section of this file otherwise. An inline disable with
no such reference is not permitted: it asserts a judgement without saying who made it or why,
which is the failure mode the general rule is guarding against. Do not add one for a finding
that has not been classified yet; classify it first, or leave the gate red and say so.

Inline disables are honoured by the scan, so adding one moves the full-scan counts. The
constant to re-pin is `reactDoctorBaselines.full`, which is what `runReactDoctor` compares the
report against. `reactDoctorFullScanTriageStatus.untriagedWarningCountAtScan` is derived and
needs no direct edit, but the two totals it subtracts do: decrement
`classifiedFindingCount` when the suppressed finding was in the classified complexity family,
and decrement the matching entry's `count` in `classifiedWarningFamilies` when it belonged to
one of those. Re-pinning the warning total alone leaves the stale classified count subtracting
a finding the scan no longer reports, which understates the untriaged number by one per missed
decrement. Record in the commit that the delta came from a documented disposition rather than
from findings disappearing.

Do not re-pin from a feature branch. `reactDoctorFullScanTriageStatusBase.scanSha` must name a
commit reachable from `main`, and a branch commit is not — squash-merging drops it, and the pin
then names something nobody can fetch to reproduce the measurement. Full-scan drift is
informational and fails nothing, so land the change first and re-pin from `main` afterwards.

### High Complexity React Function Findings

`no-high-complexity-react-function` reports when *either* cyclomatic or cognitive complexity exceeds 15; the plugin's condition is `cyclomatic <= 15 && cognitive <= 15 || report`. A function with cyclomatic 15 and cognitive 16 is reported on the cognitive side alone. Do not change the thresholds to make a count match.

Read the dominant metric together with nesting depth before triaging. Cyclomatic-dominant at nesting 1-2 is a flat fan of sibling guards in one return or one props object, where the rule's "extract independent branches" advice relocates terms without removing them. Cognitive-dominant at nesting 3-4 is nested or sequentially dependent logic, where the number describes real reading cost and extraction is at least meaningful.

Use the accepted-risk families below to triage repeat hits instead of re-litigating the same reasoning; only a hit that fits none of them needs a fresh decision.

- **Conditional-surface fan.** One return with N sibling optional slots and visibility guards for a single screen, panel, or card. The guards share the props they read, so extracted pieces re-receive most of the parent's props and the "what is visible when" contract leaves the one place a reader looks for it.
- **Shared primitive variant matrix.** A `src/components/shared` or design-system component whose API is optional props crossed with placement and tone variants. Splitting by variant duplicates generated-id derivation, ARIA wiring, and event plumbing — a correctness risk larger than the complexity removed. `LabeledInputRow` is the reference case.
- **Settings-view availability chain.** A settings view whose feature or action availability is decided by long boolean chains over the same flags — either a conjunction asserting that an optional feature's props were supplied as a set, or a disjunction over shared busy flags that gates actions. One view can contain both. The chain is one predicate, so moving it into a child relocates the same terms. Where the shape is prop presence, the real improvement is a props-shape change (one optional object instead of N optional props), which is a separate design decision, not a complexity fix.
- **Reader selection-union dispatch.** Hooks mapping the reader selection union onto queries and view state. The Rules of Hooks require every query to be called unconditionally before one is selected, so the arity of the union is a floor on the count; an extracted hook still calls all of them.
- **Container state-resolution chain.** Sequentially dependent derivations where each step consumes the previous. Not independent branches, so the rule's phrasing does not apply directly. The whole chain is extractable as one hook, which is the shape tracked by Issue #256 for `useAccountDetailViewProps` (cyclomatic 85 / cognitive 106, excluded from the pass as an outlier needing its own design).
- **Platform window-chrome matrix.** Overlay-titlebar / compact-desktop / browser-preview branching governed by `tauri-window-chrome.md`. Per-platform splitting triplicates the surface.
- **Opt-in diagnostic surface.** A lazily imported dev panel behind a preference, whose complexity is the diagnostic payload it exists to display.

A finding is `must-fix` only when it is a bug, a regression, or introduced by the current change. Render frequency alone does not promote one: a hot-path component whose complexity is conditional class selection gets *worse* under the rule's remedy, because extraction adds component instances per render. `ArticleListItem` is that case. When a hot-path finding also has a genuine render cost — missing memoization, a per-row store subscription, an unvirtualized list — record that separately; it is a different rule's concern and is not fixed by extraction.

Per-finding classifications are recorded in [../../docs/react-doctor-complexity-classification.md](../../docs/react-doctor-complexity-classification.md).

### Render-Time Ref Write Findings

`no-ref-current-in-render` reports a ref assigned during render. Classify each by **whether a
discarded render's write can be observed in a way that changes output** — by a reader outside
that render, or by a later render — not by whether the value looks stable.

The ref object is shared between the current tree and a work-in-progress render, so a render-time
assignment is visible to async continuations, DOM and window listeners, and timers before that
render commits. "A later render with the same props overwrites it" does not hold, because the
ordering is not guaranteed: an abandoned render's write can be read before the next commit
happens. Whether the ref holds a prop, state, or a derived value makes no difference — only
whether an abandoned write survives to a reader does.

That leaves two must-fix shapes, and the second is easy to mistake for safe. A ref read from
outside the render is the obvious one. A ref read only inside render is still must-fix when the
writes form a state machine across renders — `use-stable-open-translation.ts` writes a locale on
open and clears it on close, so a discarded render's write outlives it and the next render reads
a state the committed tree never produced.

A same-render reader is a false positive only when a foreign write cannot change what the reader
produces. `use-article-list-data.ts` is the one case here: its guard re-derives from a semantic
key, so a foreign write either mismatches the key and is discarded or matches it and is
equivalent. That argument depends on the key covering every field the consumer reads, so widening
the consumer means revisiting the key.

Do not use a passing test suite as evidence of a false positive. PR #241 and PR #243 were both
this rule, and in both the tests stayed green while the real screen broke.

The 2026-09-10 pass classified all 14 reported errors — 12 must-fix, 1 false positive, 1
test-only accepted risk — with the per-finding evidence and reasoning in
[../../docs/react-doctor-error-triage.md](../../docs/react-doctor-error-triage.md). The fixes are
tracked separately from that record; group them by reader type rather than landing all twelve at
once. All twelve landed in three PRs — #291 (sites 13-14, the render state machine), #292
(sites 2/6/12, DOM and window listeners), #293 (sites 4,5/7,8/9/10,11, async continuations) —
each moving the ref write into a `useLayoutEffect` so only a committed render's value reaches
the reader. Measured on `main` at `3f1867a23` the full scan went from 14 errors to 2, with
`no-ref-current-in-render` 13 -> 1 accounting for the whole delta and every warning rule
unchanged. The two that remain are this record's own false positive and its test-only accepted
risk, so `errorClassification.mustFix` is 0.

### Untriaged Warning Classification (Issue #249)

The first wave — `exhaustive-deps` 18 and `no-adjust-state-on-prop-change` 16 — is recorded per
finding in [../../docs/react-doctor-warning-classification-249.md](../../docs/react-doctor-warning-classification-249.md).
Read it before re-classifying anything in those two families.

Two things in it change how the remaining families should be approached.

`exhaustive-deps` is not one kind of finding. Of the 18, only one names an absent dependency;
14 name an identifier that is *already in the array* and complain about its identity churn, and
3 say the callback is defined elsewhere so dependencies cannot be checked. Counting them as one
backlog of "dependencies to add" is wrong.

The `no-adjust-state-on-prop-change` findings all sit on a setter whose argument is a constant,
and setters with computed arguments in the same effects are not reported. That regularity is
inferred from four counter-examples, not from the rule implementation, which is minified in the
shipped `dist`. Do not build a classification on it.

### Prop Callback In Effect Findings

`no-prop-callback-in-effect` reports an effect that calls a prop callback, and describes the cost
as "your parent re-renders on every local state change … just to stay in sync". Check whether the
effect actually mirrors state continuously before accepting that reading.

Standing accepted risk:

- `feed-edit-dialog.tsx` — the stale-account close. When the selected account no longer owns the
  feed being edited and no save or unsubscribe is in flight, the dialog calls `onOpenChange(false)`
  to hand control back to its owner. It fires on one transition, not on every local state change,
  and asking the owner to close is the only channel a controlled dialog has. The alternative —
  having the page derive staleness and clear `editTargetFeed` itself — was evaluated and rejected
  by independent review on 2026-09-11: the page cannot see the dialog's busy state without
  duplicating internal pending, an effect-delivered notification has a window before it arrives,
  and a save-loading-only signal misses the unsubscribe path entirely. The `operationActive`
  dependency is what makes the close wait for an in-flight operation and re-evaluate when it
  settles; do not remove it to quiet the rule.

### Loading Flag Reset Findings

`no-loading-flag-reset-outside-finally` reports that a busy flag is reset "only on the success
path". Check what the code actually does before accepting that reading; on 2026-09-08 all four
findings had a reset the rule's message did not describe, and the four did not share one verdict.

A **conditional** reset inside `finally` is not the shape the rule describes and must not be
made unconditional. `use-account-detail-sync-controls.ts` guards its reset with a
selected-account generation check so a stale request cannot clear the flag a newer request
owns. When the guard is false the stale owner's responsibility is ended by the `account.id`
change effect — which owns the generation bump and the ref/state reset — or by unmount, not by
"the next request will reset it anyway". Removing the guard is a regression, not a fix. That
effect is passive, so this does not claim commit-boundary freshness; that is a separate concern
from the rule's success-only claim.

A reset duplicated across `try` and `catch` is also not success-only, but it is still worth
consolidating into `finally`: work inside `catch` — error formatting, translation, a toast — can
itself throw and skip the reset, and a third path added later is easy to miss.

Do not classify a whole rule's findings in one verdict because they share a rule id.

### Adjust State On Prop Change Findings

`no-adjust-state-on-prop-change` reports an effect that calls `setState` in response to a prop,
and offers three remedies: derive during render, reset with a `key`, or update the state in the
event that changes the prop. Check which of the three is actually available before treating the
finding as a defect; where none is, the effect is the mechanism, not a mistake.

Standing accepted risk:

- `feed-edit-dialog.tsx` — the stale-account effect calls `setUnsubscribeOpen(false)` when the
  edited feed's account is no longer selected. None of the three remedies reaches it: the flag is
  opened by a user click so it cannot be derived during render; a `key` reset would remount the
  dialog and discard an in-flight save or unsubscribe, which is the very thing the surrounding
  guard exists to protect; and the event that changes the account lives outside this component.
  Leaving the flag set is not an option — the confirmation is a sibling, and owners such as
  `FeedContextMenuContent` keep the dialog mounted with `open={false}`, so the confirmation for
  the departed account would stay on screen. Reviewed 2026-09-11.

- `confirm-dialog-view.tsx` — the hold-to-confirm effect calls `cancelHold()` when `enabled`
  goes false. Disabling the button detaches its pointer handlers, so a release can no longer
  end the press; without the reset a later re-enable resumes a progress fill with no timer
  behind it. None of the three remedies reaches that: `holding` drives an imperative
  `setTimeout` and a CSS fill rather than rendered output, so it cannot be derived; a `key`
  reset would remount the dialog and drop focus; and the prop is owned by the caller, so the
  event that changes it is outside this component. What the rule describes as the cost — the
  disabled button showing its fill for the frame before the effect runs — is reasoning from
  the render order, not something observed on screen. The candidate improvement is to gate the
  *visual* state on `enabled && holding` while leaving the timer teardown in the effect, which
  would shorten that window without removing the reset; that is a state-ownership change to
  code outside the change that surfaced this, so it belongs in its own pass. Reviewed
  2026-09-09.

### Iteration And Lookup Shape Findings

`js-combine-iterations` and `js-set-map-lookups` describe shape, not cost. A `src/` path is not
by itself evidence of a hot path, and rewriting a small fixed-size lookup into a per-render
`Set` makes the code do more work. Classify each site by the size of what it iterates and by
how often the surrounding code runs, and do not report a shape rewrite as a measured
performance win.

Standing accepted risk:

- `article-list-footer.tsx` — the reported spread-lookup is over the small fixed set of list
  modes. `disabledModes.includes(...)` stays; building a `Set` on every render has no basis at
  that size. Reviewed 2026-09-08.
- `use-account-detail-danger-zone.ts` — the reported filter-then-map runs once after an account
  is deleted. A single pass is possible while preserving order and the first-element fallback,
  but the frequency does not justify the churn. Reviewed 2026-09-08.

A nested membership test is a different case: a `filter` whose predicate scans an array for
each element is quadratic in the two sizes, and building the membership `Set` once inside the
same function removes that without changing the contract. Keep the original array whenever a
later step derives ordering from it.

### Behavioural Single Findings

These three were classified on 2026-09-08 and are not mechanical fixes.

- `no-self-updating-effect` (`use-subscriptions-index-state.ts`) — the effect converges: the
  next run returns early once `layoutGeneration` and `viewportHeight` agree. Already carried an
  accepted-risk comment, and that classification is inherited. Being self-updating is not by
  itself a reason to rewrite it.
- `prefer-use-sync-external-store` (`subscriptions-index-page.tsx`) — external viewport-size
  synchronisation. Migrating is not mandatory absent an observed defect; promoting the value to
  a shared store is a separate design task. The subscription's full lifecycle has not been
  audited.
- `prefer-html-dialog` (`ui-reference-shell-specimens.tsx`) — a motion specimen absolutely
  positioned inside a fixed 210px frame. A native `dialog` with `showModal` changes top-layer,
  focus, and overlay behavior, so it is not a mechanical substitution. Accepted risk for a
  display surface with no real modal contract; if it ever becomes a keyboard-operable target,
  audit its accessibility requirements separately rather than exempting it for being a story.

### Lazy Ref Init Findings

`rerender-lazy-ref-init` suggests `useRef(null)` plus initialisation on first render. That form
writes `ref.current` during render, which fires `no-ref-current-in-render` — an error. Applying
it to two sites on 2026-09-08 traded 2 warnings for 2 errors (14 → 16), so it was reverted.

`useState` with an initialiser function is not a general substitute: it captures once, so a
value that must follow props goes stale. Decide who owns the state and what lifetime it needs
before touching these; do not change code to trade one rule for another, and do not record them
as accepted risk without that decision. They remain untriaged under Issue #249.

### Supply Chain Hardening Findings

`require-pnpm-hardening` asks for `trustPolicy`. Adopting `no-downgrade` is a supply-chain
policy decision, not a lint fix, and belongs to its own preflight rather than a React Doctor
triage pass. The preflight must record which packages the policy rejects and why, run against
the current manifest and lockfile in an isolated scratch checkout — never by editing `main` or
global configuration to observe the effect — and confirm the rejection condition against a
controlled fixture or upstream test. A successful frozen install does not demonstrate that a
future update's weakened trust signal would be caught.

That preflight ran under <https://github.com/jey3dayo/ultra-rss-reader/issues/264>. The
measurements are below; the decision it produced is here.

#### Decision: adopted on 2026-09-10

`pnpm-workspace.yaml` sets `trustPolicy: no-downgrade` with one entry in
`trustPolicyExclude`. Exclusions follow the Dependency Advisory Policy above: never anonymous,
always with the package, the reason, and the date, recorded here as well as at the setting.

Current exclusions:

- `semver@6.3.1` — reached transitively through `@babel/core` and
  `@babel/helper-compilation-targets`. `pnpm why semver --prod` returns no match, so it never
  reaches the shipped bundle. Remove this entry once Babel widens its `semver` range; verify
  with `pnpm install --frozen-lockfile --no-trust-lockfile` after dropping it. Registered
  2026-09-10.

`--no-trust-lockfile` is what re-runs the check when the cached verdict would otherwise be
reused, so use it whenever the point is to observe the policy rather than to install. Measured
2026-09-10: with the exclusion the repository's 1102 lockfile entries pass; replacing the
exclusion with a name that matches nothing fails with `ERR_PNPM_TRUST_DOWNGRADE` naming
`semver@6.3.1`, which is how this entry is known to be load-bearing rather than decorative.

Two exclusion mechanisms exist and only the first is used here. `trustPolicyExclude` names
specific packages or versions. `trustPolicyIgnoreAfter` skips the check for anything published
longer ago than a given duration, which would silently cover packages nobody reviewed, so it is
deliberately left unset.

#### 2026-09-10 preflight evidence

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

## Accepted Rust File-Length Exceptions

- `src-tauri/src/service/sync_scheduler/mod.rs` remains at 551 production lines after the responsibility split. This is an accepted exception decided on 2026-08-29: it is less than 10% above the 500-line guideline, and further splitting would make startup wiring less readable.

## Similarity Report Baseline

Use `mise run report:similarity` for the regular duplicate-code report. It wraps `similarity-ts --threshold 0.9 src/`, records TODO-backed false positives in `scripts/similarity-report.ts`, and treats drift as report output until it is triaged into TODO updates or refactoring work.

### Rust Similarity Scan

`mise run report:similarity` runs `similarity-rs` against `src-tauri/src/` after the TypeScript/CSS scan. The Rust scan is report-only: its gate is disabled, it is skipped when a custom target path is supplied or on platforms other than Linux and macOS, and its output currently reports duplicate-pair counts rather than pair details.

Do not register Rust false positives in `similarityFalsePositiveBaseline` in `scripts/similarity-report.ts`. `findFalsePositiveMatch` consumes the output of `parseSimilarityPairs`, which is the TypeScript scan's pair data, while the Rust path only reports counts through `buildSimilarityRustSummary`; such entries would never match and would be dead data. Record the 2026-08-29 Rust triage result in prose instead: there are no immediate extraction candidates, and the 76 pairs at 0.95+ among 256 pairs come from tests, newtypes, or platform branches, or require a deliberate contract-preserving design decision. Reconsider this policy if Rust pair analysis is added in the future.

Future-wave triage candidates are: local import/export preamble sharing; pending-mutation query-and-save helpers (only with the transaction contract preserved); a lock-poisoned-error mapper; a browser back/forward direction helper; an article query-builder seam; parameterizing tag-mutation operations; a mute-keyword transaction helper; shared `trigger_sync` account/feed orchestration; a GReader subscriptions/folders endpoint flow; and a unified Result-versus-fallback contract for the local provider.

Treat the following families as false positives: escape-accelerator platform branches, typed-ID newtypes, updater `Drop` implementations, fixture and test families, the browser security classifier, provider policy boundaries, and success/failure scheduling branches.

Threshold usage:

- `0.95`: near-copy candidates that should usually become immediate extraction or deletion work.
- `0.9`: regular baseline for TODO triage and recurring report updates.
- `0.87`: exploratory scan matching the tool default; use it only when looking for broader patterns after the `0.9` baseline is understood.

Record false positives only when the pair is structurally similar but intentionally has different ownership, lifecycle, or domain boundaries. TODO-backed pairs should keep the TODO label in the report baseline until the main TODO entry is removed.

## Similarity False Positives

Similarity reports are triage input, not an automatic refactoring queue. Before extracting shared code, classify the repeated unit by responsibility:

- UI lifecycle hooks may share async guard shape, but keep them separate when one hook owns native browser overlay close/focus ordering and another module only builds static sidebar view models.
- Small React Query cache helpers are standalone account cache policy. Do not merge them with large hook lifecycle effects just because both contain guarded updates or array replacement.
- Cache helpers may share local helper functions within the same cache module, but do not extract app-wide cache abstractions unless multiple cache modules share the same key contract and invalidation semantics.
- For low-token or short functions, treat 90-95% similarity as a false-positive candidate until a focused rerun with a higher minimum size still reports the pair.

When reading `similarity-ts` output, use the default scan to find candidates, then rerun suspicious small pairs with focused paths and size guards such as `--min-lines 8` and `--min-tokens 60`. Prefer investigating large hooks, repeated domain transformations, and repeated runtime-boundary logic; skip structural matches between different layers unless the shared responsibility is explicit.

Repository-specific heuristics:

- `0.95+` should currently be close to empty; a new hit there is worth reading immediately.
- Pairs involving `useUpdater`, browser lifecycle hooks, sidebar controller hooks, or article auto-mark hooks are structural noise unless a small pure helper inside them is identical.
- Browser surface `AppError` detection is a valid shared helper only for `UserVisible | Retryable` non-empty messages. Broader article action error coercion is intentionally separate.
