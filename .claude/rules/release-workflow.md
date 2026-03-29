---
paths:
  - ".github/workflows/release.yml"
  - ".github/release.yml"
  - ".github/PULL_REQUEST_TEMPLATE.md"
  - "src-tauri/tauri.conf.json"
  - "src-tauri/Cargo.toml"
  - "package.json"
---

# リリースワークフロー

## 制約

- リリースは Git タグ (`v*`) プッシュでトリガーする
- `tauri-apps/tauri-action@v0` を使用してビルド・Release 作成・アーティファクト添付を行う
- ビルドマトリクスは macOS arm64 (`macos-latest`) + Windows (`windows-latest`) の 2 並列
- GitHub Release は Draft として作成し、手動で Publish に切り替える
- `generateReleaseNotes` は `false`。リリースノートは CLI（`gh release edit/create`）で管理し、`tauri-action` はアーティファクト添付のみ担当する
- GitHub Actions の uses にはコミットハッシュ pin + バージョンコメントを付与する
- `fail-fast: false` で一部のプラットフォーム失敗が他に波及しないようにする

## バージョン管理

- バージョンは `tauri.conf.json` の `version`、`Cargo.toml` の `version`、`package.json` の `version` の 3 箇所で管理される
- タグ作成前に 3 箇所のバージョンが一致していることを確認する
- セマンティックバージョニング (semver) に従う

## 開発フロー（リリースノート自動生成の前提）

- feature branch → PR → merge の運用を徹底する
- main への直接コミットは避ける（`generateReleaseNotes` は PR ベースで生成するため、直接コミットはリリースノートに載らない）
- PR 作成時に種別に応じたラベルを付与する
- `.github/release.yml` でラベルごとにリリースノートを自動分類する
- `skip-changelog` ラベルで特定 PR をリリースノートから除外できる

## コミット・ラベル・リリースノートの対応

コミット prefix、PR ラベル、リリースノートカテゴリは一致させる。

| コミット prefix              | PR ラベル  | リリースノートカテゴリ |
| ---------------------------- | ---------- | ---------------------- |
| `feat:`                      | `feature`  | 🚀 Features            |
| `fix:`                       | `fix`      | 🐛 Bug Fixes           |
| `docs:`                      | `docs`     | 📚 Documentation       |
| `chore:`/`refactor:`/`test:` | `chore`    | 🔧 Maintenance         |
| (breaking change)            | `breaking` | 💥 Breaking Changes    |

## リリースコマンド構造

`/release` コマンドは 3 フェーズで構成される:

1. **Phase 1: Pre-checks + Version** — バージョン一致確認、ブランチ・ワークツリー確認、バージョンバンプ
2. **Phase 2: Changes + Release Notes** — CHANGELOG 生成、リリースノート作成（`gh release edit/create` 経由）
3. **Phase 3: Commit + Tag + Publish** — コミット、タグ作成、プッシュ、GitHub Release ワークフローのトリガー

## 根拠

Tauri アプリのクロスプラットフォームビルドは OS 固有のツールチェーンが必要なため、GitHub Actions のマトリクスビルドで各プラットフォーム用 runner を使い分ける。`tauri-action` が Tauri CLI のインストールからビルド、Release 作成まで一括で行うため、手動構成より安全かつ簡潔。

## スコープ外（将来追加可能）

- コード署名（Apple Developer Program / Windows EV 証明書）
- Linux ビルド（.deb / .AppImage）
