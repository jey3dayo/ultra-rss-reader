# .claude/rules Index

このディレクトリにあるプロジェクト固有ルールの目次です。
`AGENTS.md` / `CLAUDE.md` とは別に、分野ごとの詳細ルールをここから辿れるようにしています。

## UI / Design

- [ui-browser-prep.md](./ui-browser-prep.md): UI 調整前後にブラウザ実画面で確認する手順
- [ui-design-review-loop.md](./ui-design-review-loop.md): UI 実装後に 95 点以上を目標としてデザインレビューと修正を反復するルール
- [color-pattern.md](./color-pattern.md): インタラクティブ要素の ON / OFF 状態に使う色パターン
- [shadcn-ui.md](./shadcn-ui.md): `src/components/ui/` の扱いと shadcn/ui 利用ルール

## Frontend / Tauri

- [tauri-ipc-error-handling.md](./tauri-ipc-error-handling.md): Tauri IPC のエラーハンドリング方針
- [runtime-boundary.md](./runtime-boundary.md): Browser API / Tauri runtime / storage / platform globals の境界処理方針
- [async-side-effect-policy.md](./async-side-effect-policy.md): fire-and-forget、latest-only、unmount cleanup、optimistic update の方針
- [schema-boundary.md](./schema-boundary.md): DTO / preferences / localStorage schema の strictness と fallback 所有者
- [contract-test-policy.md](./contract-test-policy.md): contract test の置き場所、TODO 化する境界値、ルール昇格の判断基準
- [tauri-window-chrome.md](./tauri-window-chrome.md): OS ごとに異なる titlebar / header の扱いと現在の実装方針
- [preferences-pattern.md](./preferences-pattern.md): Preferences の読み書きパターン
- [dev-scenarios-command-palette.md](./dev-scenarios-command-palette.md): dev intent と command palette の共通 runner / 責務分離ルール

## Repository Structure

- 通常の feature UI は `src/components/<feature>/` に置く
- 複数 feature で再利用する UI は `src/components/shared/` に置く
- shadcn/Base UI wrapper は `src/components/ui/` に限定する
- cross-feature data hook は `src/hooks/`、cross-feature pure helper は `src/lib/` に置く
- feature 内だけで使う hook は `src/components/<feature>/hooks/` に置く
- app-wide action boundary は `src/lib/actions.ts` / `src/lib/app-actions.ts` に残す。keyboard、menu、command palette、dev scenario、IPC validation で共有されるため
- app-wide runtime singleton や中立 primitive は `src/lib` root に残す。例: `i18n.ts`、`datetime.ts`、`utils.ts`
- cross-pane DOM focus helper は `src/lib/reader-focus.ts` に残す。`src/lib/reader/` は reader query / source planning 用
- frontend-owned runtime schema は `src/schemas/` に置く。local config、localStorage、preferences など IPC 以外の検証が対象
- Tauri IPC request / response schema は `src/api/schemas/` に置く。local storage や app config schema と混ぜない
- cross-feature literal は `src/constants/`、共有 type-only contract は `src/lib/*.types.ts` に置く
- reusable test helper は `tests/helpers/` に置き、frontend tests からは `@tests/helpers/*` で import する
- sample DTO / data fixture は `tests/helpers/fixtures.ts`、Tauri IPC mock setup は `tests/helpers/tauri-mocks.ts`、test-only の Tauri mock call contract は `tests/helpers/tauri-types.ts` に分ける
- 大きい feature の controller hook は、再利用されない限り feature 配下の `hooks/` に co-locate してよい
- reader 専用の pure helper は `src/components/reader/` に残してよい。`lib` / `stores` / 他 feature から必要になった時だけ `src/lib/` へ出す
- `rules/tools/` は外部ツール向け routing shim の置き場。日常的な project rule はこの `.claude/rules/` に置く

## Rust

- [rust-async-mutex.md](./rust-async-mutex.md): `std::sync::Mutex` と `async` を安全に併用する指針
- [rust-keyring.md](./rust-keyring.md): OS Keyring を使った認証情報管理の方針

## Release / Operations

- [release-workflow.md](./release-workflow.md): バージョン管理からリリースまでのワークフロー
- [macos-dev-codesign.md](./macos-dev-codesign.md): macOS 開発用コード署名のセットアップと運用
- [macos-app-troubleshoot.md](./macos-app-troubleshoot.md): macOS ビルド済みアプリの起動トラブル対処
