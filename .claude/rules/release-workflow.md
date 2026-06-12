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
- macOS は Developer ID なし前提でリリースする。`src-tauri/tauri.release.conf.json` は ad-hoc signing (`signingIdentity: "-"`) を使い、workflow は `codesign --verify --deep --strict` を必須検証にする
- Gatekeeper / notarization 評価は Apple 公証情報が設定されている場合のみ必須。未設定時の `spctl` reject は既知の配布制約として記録し、release failure 扱いにしない
- schema bump（`src-tauri/src/infra/db/migration.rs` の `LATEST_VERSION` 変更）を含むリリースでは、リリースノートに「このバージョンへ更新後は旧バージョンへのダウングレード起動がブロックされる」旨を明記する

## バージョン管理

- バージョンは `tauri.conf.json` の `version`、`Cargo.toml` の `version`、`package.json` の `version` の 3 箇所で管理される
- タグ作成前に 3 箇所のバージョンが一致していることを確認する
- release タグは version bump commit を作成した後、その `HEAD` commit に対して作成する
- push 前に `git rev-list -n 1 vX.Y.Z` が release commit hash と一致し、tag 先の 3 ファイルが同じ `X.Y.Z` を返すことを確認する
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

1. Phase 1: Pre-checks + Version — バージョン一致確認、ブランチ・ワークツリー確認、バージョンバンプ
2. Phase 2: Changes + Release Notes — CHANGELOG 生成、リリースノート作成（`gh release edit/create` 経由）
3. Phase 3: Commit + Tag + Publish — コミット、タグ作成、プッシュ、GitHub Release ワークフローのトリガー

ユーザーが bump 種別と公開意図を明示している場合、各フェーズ間で同じ確認を繰り返さず、必須チェックと検証に失敗した場合だけ停止する。公開意図がない場合は、リリースノート確認と push 前確認を行う。

## 根拠

Tauri アプリのクロスプラットフォームビルドは OS 固有のツールチェーンが必要なため、GitHub Actions のマトリクスビルドで各プラットフォーム用 runner を使い分ける。`tauri-action` が Tauri CLI のインストールからビルド、Release 作成まで一括で行うため、手動構成より安全かつ簡潔。

## スコープ外（将来追加可能）

- Developer ID / Apple notarization による macOS 配布
- Windows EV 証明書
- Linux ビルド（.deb / .AppImage）
