---
paths:
  - ".claude/rules/**"
---

# .claude/rules Index

このディレクトリにあるプロジェクト固有ルールの目次です。
`AGENTS.md` / `CLAUDE.md` とは別に、分野ごとの詳細ルールをここから辿れるようにしています。

## UI / Design

- [ui-browser-prep.md](./ui-browser-prep.md): UI 調整前後にブラウザ実画面で確認する手順
- [ui-design-review-loop.md](./ui-design-review-loop.md): UI 実装後に観点別 pass/finding/N/A の記録と must-fix 解消を条件にデザインレビューを反復するルール
- [motion-exit-animation.md](./motion-exit-animation.md): 退場アニメーションの base クラスは平常時から当てる、収縮 owner は親子で1つ、後始末を `transitionend` に依存しない、grid ラッパーの item には `min-height: 0` と `min-width: 0` を両方当てる
- [dialog-keyboard-confirm.md](./dialog-keyboard-confirm.md): ダイアログの Enter 確定。確認は主アクションへ初期フォーカス、フォームは submit ボタンを `<form>` の子孫に置く。user-event の Enter は実ブラウザの implicit submission ではないので実画面確認とセットにする
- [color-pattern.md](./color-pattern.md): インタラクティブ要素の ON / OFF 状態に使う色パターン
- [shadcn-ui.md](./shadcn-ui.md): `src/components/ui/` の扱いと shadcn/ui 利用ルール

## Frontend / Tauri

- [tauri-ipc-error-handling.md](./tauri-ipc-error-handling.md): Tauri IPC のエラーハンドリング方針
- [result-boundary.md](./result-boundary.md): `@praha/byethrow` Result の配置境界と component 直 import 回避ルール
- [runtime-boundary.md](./runtime-boundary.md): Browser API / Tauri runtime / storage / platform globals の境界処理方針
- [async-side-effect-policy.md](./async-side-effect-policy.md): fire-and-forget、latest-only、unmount cleanup、optimistic update の方針
- [schema-boundary.md](./schema-boundary.md): DTO / preferences / localStorage schema の strictness と fallback 所有者
- [boundary-ownership.md](./boundary-ownership.md): refactor 時の owner 判定表と移動先ルール
- [contract-test-policy.md](./contract-test-policy.md): contract test の置き場所、TODO 化する境界値、ルール昇格の判断基準
- [code-policy.md](./code-policy.md): 依存 advisory と pnpm バージョンの方針、TypeScript 単一バージョン方針と alias 復活の条件、React Compiler opt-in、ES2023 array copy methods
- [quality-policy.md](./quality-policy.md): Knip の ignore と unused export / type findings の分類手順、TODO priority taxonomy と aging、React Doctor の scan scope、similarity の baseline
- [similarity-false-positives.md](./similarity-false-positives.md): similarity report の false positive の判定と、共有 helper を抽出してよい条件
- [react-doctor-triage.md](./react-doctor-triage.md): React Doctor warning の分類と suppression の記録方法、scan task が自動実行されないこと、diff gate の degraded 表示、`scanSha` の契約、`no-high-complexity-react-function` の構造ファミリ別 triage、`no-loading-flag-reset-outside-finally` / 反復・探索形 / 振る舞い単発 / lazy ref init / 供給網 hardening の各 finding の分類、未 triage warning 第 1 波・第 2 波の分類記録への導線、suppress で別ルールが露出する挙動、同一行への disable 2 段重ね、audit mode（`--no-respect-inline-disables`）併記の必要性、classified family の count 陳腐化。path-scoped（読み込み条件は frontmatter の `paths:`）
- [tauri-window-chrome.md](./tauri-window-chrome.md): OS ごとに異なる titlebar / header の扱いと現在の実装方針
- [preferences-pattern.md](./preferences-pattern.md): Preferences の読み書きパターン
- [dev-scenarios-command-palette.md](./dev-scenarios-command-palette.md): dev intent と command palette の共通 runner / 責務分離ルール

## Local Quality Gates

- React Doctor diff scan reports findings new against `origin/main`: `mise run quality:react-doctor:diff`. Manual — no CI job or hook runs it.
- React Doctor full scan is an informational baseline report: `mise run quality:react-doctor:full`.
- Knip baseline drift is reported with `mise run report:knip`; humans decide how to triage the findings.
- Similarity baseline drift is reported with `mise run report:similarity`.
- Tool versions and baseline counts are fixed in `package.json`, `pnpm-lock.yaml`, and `scripts/quality-baseline.ts`; update them together only after intentional triage.

## Repository Structure

- [repository-structure.md](./repository-structure.md): feature/shared/ui のディレクトリ配置、design-system barrel の import 境界、schema や test helper の置き場所

## Rust

- [rust-async-mutex.md](./rust-async-mutex.md): `std::sync::Mutex` と `async` を安全に併用する指針
- [rust-keyring.md](./rust-keyring.md): OS Keyring を使った認証情報管理の方針
- [rust-test-unwrap-policy.md](./rust-test-unwrap-policy.md): Rust tests の `unwrap` / `expect` を fixture boundary と production behavior boundary に分類する方針
- [rust-cfg-split-policy.md](./rust-cfg-split-policy.md): cfg ゲート付きコードの分割時は import にも同じ cfg を付ける。macOS ローカル緑を merge 根拠にせず CI の Linux/Windows lint を見る
- [remote-state-reconciliation.md](./remote-state-reconciliation.md): リモート状態反映時の保護リストは apply と同一 DB ロック内で読み直す(pull_state またぎの TOCTOU 防止)

## Release / Operations

- [release-workflow.md](./release-workflow.md): バージョン管理からリリースまでのワークフロー
- [macos-dev-codesign.md](./macos-dev-codesign.md): macOS 開発用コード署名のセットアップと運用
- [macos-app-troubleshoot.md](./macos-app-troubleshoot.md): macOS ビルド済みアプリの起動トラブル対処
