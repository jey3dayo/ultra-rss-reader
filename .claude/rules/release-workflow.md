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
- push 前に `RELEASE_TAG=vX.Y.Z mise run release:preflight:local` を実行し、GitHub Actions の artifact build 前 preflight に近い軽量ゲートをローカルで先取りする
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

## updater 署名鍵運用

### 鍵の所在と利用経路

- 署名方式: Ed25519 / minisign（`tauri-plugin-updater` 標準形式）
- 公開鍵: `src-tauri/tauri.conf.json` の `plugins.updater.pubkey` フィールドに base64 エンコードで焼き込み済み
- 秘密鍵・パスワード・公開鍵: 1Password に保管
- CI での利用: `tauri-apps/tauri-action` ステップが環境変数 `TAURI_SIGNING_PRIVATE_KEY` と `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` を受け取り、ビルド時に updater アーティファクトへ署名する
  - これらは GitHub Actions secrets `TAURI_SIGNING_PRIVATE_KEY` および `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` として登録されている
  - preflight ジョブが両 secrets の存在を確認し、未設定の場合はビルドを中断する

### 鍵ローテーション手順

> **前提（必ず最初に確認すること）**: 旧バージョンのアプリには旧公開鍵が焼き込まれているため、新リリースの署名検証に失敗し自動更新できなくなる。ローテーション後の最初のリリースでは、既存ユーザーへ手動再インストール案内を添えること。

1. `tauri signer generate -w <出力パス>` で新しい鍵ペアを生成する
2. GitHub Actions secrets `TAURI_SIGNING_PRIVATE_KEY` と `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` を新しい鍵で更新する
3. 1Password の保管内容を新しい鍵ペア（秘密鍵・パスワード・公開鍵）に更新する
4. `src-tauri/tauri.conf.json` の `plugins.updater.pubkey` を新しい公開鍵に差し替える。この変更は通常の feature branch → PR フローでマージし、マージ後の最初のリリースで反映される

### 鍵喪失・漏洩時の対応

**喪失時（秘密鍵が手元にない）**:

- 既存ユーザーへの自動更新配信が不可能になる
- 新しい鍵ペアで署名した新バージョンを GitHub Release に配布し、全ユーザーへ手動再インストールを案内する
- 再インストール後は新公開鍵が焼き込まれるため、以降のリリースで自動更新が再開する

**漏洩時（秘密鍵が第三者に知られた可能性がある）**:

- 直ちに上記のローテーション手順を実施して旧鍵を無効化する
- 漏洩した鍵で署名された不正アーティファクトが配布されるリスクがあるため、GitHub Release の整合性検証ログを確認し、不正なアーティファクトがないかチェックする
- 必要に応じて影響範囲のユーザーに注意喚起する

### staged rollout 不在の accepted-risk

現在の updater は `latest.json` を差し替えることで全ユーザーへ即時に更新を届ける構成であり、段階配信（staged rollout）は未実装である。これは以下の accepted-risk として明文化する:

- リリース後に重大不具合が見つかった場合は fix-forward で対応する（`docs/incident-runbook.md` の Schema Bump Release Regression 参照）
- 段階配信の実装は将来 TODO として分離する

## スコープ外（将来追加可能）

- Developer ID / Apple notarization による macOS 配布
- Windows EV 証明書
- Linux ビルド（.deb / .AppImage）
