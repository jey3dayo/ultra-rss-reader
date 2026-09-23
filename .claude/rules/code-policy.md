---
paths:
  - "src/**/*.{ts,tsx}"
  - "package.json"
  - "pnpm-workspace.yaml"
  - "vite.config.ts"
  - "tsconfig.json"
  - "mise.toml"
  - ".cargo/audit.toml"
  - "src-tauri/Cargo.toml"
  - "scripts/check-toolchain-contract.ts"
  - ".storybook/main.ts"
  - "components.json"
---

# Code Policy

TypeScript / dependency / build-target rules that apply while editing `src/**` or the toolchain manifests.

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
