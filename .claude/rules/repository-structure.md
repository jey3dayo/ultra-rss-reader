---
paths:
  - "src/**/*.{ts,tsx}"
  - "tests/**"
---

# Repository Structure

- 通常の feature UI は `src/components/<feature>/` に置く
- 複数 feature で再利用する UI は `src/components/shared/` に置く
- shadcn/Base UI wrapper は `src/components/ui/` に限定する
- 共有 UI の公開 import は `@/design-system`（`src/design-system/index.ts`）に集約する。`src/components/ui/` と `src/components/shared/` は実装 owner として残し、app / feature / Storybook / test code は barrel 経由で import する。逆に実装 owner 側から `@/design-system` を import しない。shared-vs-local 判定は [../../DESIGN_REVIEW.md](../../DESIGN_REVIEW.md) を参照する
- この import 境界は `src/__tests__/components/design-system-import-boundary.node.test.ts` が強制する。直接 import が許される例外（cmdk の Command family、story 参照、headless primitive を直接触る test）は同テストの allowlist が正本なので、allowlist に載っているファイルを drift として扱わない。例外を増やすときは allowlist も同じ変更で更新する
- cross-feature data hook は `src/hooks/`、cross-feature pure helper は `src/lib/` に置く
- feature 内だけで使う hook は `src/components/<feature>/hooks/` に置く
- app-wide action boundary は `src/lib/actions.ts` / `src/lib/app-actions.ts` に残す。keyboard、menu、command palette、dev scenario、IPC validation で共有されるため
- app-wide runtime singleton や中立 primitive は `src/lib` root に残す。例: `i18n.ts`、`datetime.ts`、`utils.ts`
- cross-pane DOM focus helper は `src/lib/reader-focus.ts` に残す。`src/lib/reader/` は reader query / source planning 用
- frontend-owned runtime schema は `src/schemas/` に置く。local config、localStorage、preferences など IPC 以外の検証が対象
- Tauri IPC request / response schema は `src/api/schemas/` に置く。local storage や app config schema と混ぜない
- refactor 時の移動先判断は [boundary-ownership.md](./boundary-ownership.md) の owner 表を参照する
- cross-feature literal は `src/constants/`、共有 type-only contract は `src/lib/*.types.ts` に置く
- reusable test helper は `tests/helpers/` に置き、frontend tests からは `@tests/helpers/*` で import する
- sample DTO / data fixture は `tests/helpers/fixtures.ts`、Tauri IPC mock setup は `tests/helpers/tauri-mocks.ts`、test-only の Tauri mock call contract は `tests/helpers/tauri-types.ts` に分ける
- 大きい feature の controller hook は、再利用されない限り feature 配下の `hooks/` に co-locate してよい
- reader 専用の pure helper は `src/components/reader/` に残してよい。`lib` / `stores` / 他 feature から必要になった時だけ `src/lib/` へ出す
- component-local pure helper を `src/lib/` に抽出する時は、React-free、UI-copy-free、store-free、Tauri-command-free な logic だけを移す
- hook、toast execution、store access、listener lifecycle、optimistic update、component props、view label は owning feature に残す
- tests、mocks、近傍 component が旧 feature module の public surface を import している時は、互換 re-export を優先する
- コマンド実行方針は [../../CLAUDE.md](../../CLAUDE.md) と [../../mise.toml](../../mise.toml) を参照する。日常的な project rule はこの `.claude/rules/` に置く
