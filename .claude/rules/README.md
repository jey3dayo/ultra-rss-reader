# .claude/rules Index

このディレクトリにあるプロジェクト固有ルールの目次です。

## UI / Design

- `ui-browser-prep.md`: UI 調整前後にブラウザ実画面で確認する手順
- `color-pattern.md`: インタラクティブ要素の ON / OFF 状態に使う色パターン
- `shadcn-ui.md`: `src/components/ui/` の扱いと shadcn/ui 利用ルール

## Frontend / Tauri

- `tauri-ipc-error-handling.md`: Tauri IPC のエラーハンドリング方針
- `preferences-pattern.md`: Preferences の読み書きパターン

## Rust

- `rust-async-mutex.md`: `std::sync::Mutex` と `async` を安全に併用する指針
- `rust-keyring.md`: OS Keyring を使った認証情報管理の方針

## Release / Operations

- `release-workflow.md`: バージョン管理からリリースまでのワークフロー
- `macos-dev-codesign.md`: macOS 開発用コード署名のセットアップと運用
- `macos-app-troubleshoot.md`: macOS ビルド済みアプリの起動トラブル対処
