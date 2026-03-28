---
paths:
  - ".github/workflows/release.yml"
  - "src-tauri/tauri.conf.json"
  - "src-tauri/Cargo.toml"
  - "package.json"
---

# リリースワークフロー

## 制約

- リリースは Git タグ (`v*`) プッシュでトリガーする
- `tauri-apps/tauri-action@v0` を使用してビルド・Release 作成・アーティファクト添付を行う
- ビルドマトリクスは macOS (arm64: `macos-latest`, x86_64: `macos-13`) + Windows (`windows-latest`) の 3 並列
- macOS ビルドでは `--target` で明示的にアーキテクチャを指定する
- Rust ターゲットの指定は runner OS で分岐する（`runner.os == 'macOS'` の場合のみ指定）
- GitHub Release は Draft として作成し、手動で Publish に切り替える
- GitHub Actions の uses にはコミットハッシュ pin + バージョンコメントを付与する
- `fail-fast: false` で一部のプラットフォーム失敗が他に波及しないようにする

## バージョン管理

- バージョンは `tauri.conf.json` の `version`、`Cargo.toml` の `version`、`package.json` の `version` の 3 箇所で管理される
- タグ作成前に 3 箇所のバージョンが一致していることを確認する
- セマンティックバージョニング (semver) に従う

## 根拠

Tauri アプリのクロスプラットフォームビルドは OS 固有のツールチェーンが必要なため、GitHub Actions のマトリクスビルドで各プラットフォーム用 runner を使い分ける。`tauri-action` が Tauri CLI のインストールからビルド、Release 作成まで一括で行うため、手動構成より安全かつ簡潔。

## スコープ外（将来追加可能）

- コード署名（Apple Developer Program / Windows EV 証明書）
- 自動アップデーター（`tauri-plugin-updater`）
- Linux ビルド（.deb / .AppImage）
