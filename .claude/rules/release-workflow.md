---
paths:
  - ".github/workflows/release.yml"
  - ".github/workflows/release-start.yml"
  - "scripts/release/start-release.ts"
  - "scripts/release/guard-release-build.ts"
  - ".github/release.yml"
  - ".github/PULL_REQUEST_TEMPLATE.md"
  - "src-tauri/tauri.conf.json"
  - "src-tauri/Cargo.toml"
  - "src-tauri/Cargo.lock"
  - "msix/Package.appxmanifest"
  - "package.json"
  - "scripts/release/bump-version.ts"
  - "scripts/release/validate-release-config.ts"
  - ".codex/skills/release/scripts/release_checks.py"
---

# リリースワークフロー

## 制約

- 開始経路は Local CLI の annotated `v*` tag push、または `release-start.yml` の **Start Release**。Actions は reviewed exact-main SHA の CI 成功を確認し、annotated tag と draft を作って tag ref で release build を起動する。詳細・復旧の正本は `docs/release-actions-start.md`
- `tauri-apps/tauri-action@v0` を使用してビルド・Release 作成・アーティファクト添付を行う
- tag push の既定ビルドマトリクスは macOS arm64 (`macos-latest`) + Windows (`windows-latest`) の 2 並列。`workflow_dispatch` の `build_linux=true` では updater 対象外の Ubuntu `.deb` / AppImage を追加する
- release workflow は Draft を維持する。両 entry point の Phase 4 が、元の build run・必須ゲート・アーティファクト・適用される手動確認と公開承認を確認し、認証済み CLI または GitHub UI で Publish する
- `generateReleaseNotes` は `false`。Local CLI は `gh release edit/create`、Actions は reviewed `CHANGELOG.md` の version section から本文を管理する
- 失敗・再試行・dry run・asset 再利用の判断は [Actions runbook の Failure and recovery](../../docs/release-actions-start.md#failure-and-recovery) を正本にする。ここでは条件を重複定義しない
- GitHub Actions の uses にはコミットハッシュ pin + バージョンコメントを付与する
- `fail-fast: false` で一部のプラットフォーム失敗が他に波及しないようにする
- macOS は Developer ID なし前提でリリースする。`src-tauri/tauri.release.conf.json` は ad-hoc signing (`signingIdentity: "-"`) を使い、workflow は `codesign --verify --deep --strict` を必須検証にする
- Gatekeeper / notarization 評価は Apple 公証情報が設定されている場合のみ必須。未設定時の `spctl` reject は既知の配布制約として記録し、release failure 扱いにしない
- schema bump（`src-tauri/src/infra/db/migration/mod.rs` の `LATEST_VERSION` 変更）を含むリリースでは、リリースノートに「このバージョンへ更新後は旧バージョンへのダウングレード起動がブロックされる」旨を明記する

## バージョン管理

- バージョンは `tauri.conf.json` の `version`、`Cargo.toml` の `version`、`package.json` の `version`、`src-tauri/Cargo.lock` の `ultra-rss-reader` package entry、`msix/Package.appxmanifest` の `Identity Version`(形式は `X.Y.Z.0`)の 5 箇所で管理される
- バージョンを変更するときは `node scripts/release/bump-version.ts <new_version>` を使い、5 箇所を一括更新する
- タグ作成前に 5 箇所のバージョンが一致していることを確認する
- release タグは version / CHANGELOG 変更を含む reviewed commit に作成する。Local CLI は release commit の `HEAD`、Actions は merge 後に CI 成功を確認した exact-main SHA を使う
- Local CLI の push 前に `git rev-list -n 1 vX.Y.Z` と release commit hash、tag 先の 5 箇所の `X.Y.Z`（MSIX は `X.Y.Z.0`）一致を確認する。Actions starter も同じ version / tag target 契約を検証する
- Local CLI の push 前に `RELEASE_TAG=vX.Y.Z mise run release:preflight:local` を実行する。Actions は exact-main CI と既存 release workflow の必須ゲートを使い、ローカルで未実行のチェックを実行済みと扱わない
- セマンティックバージョニング (semver) に従う

## 開発フロー（リリースノート自動生成の前提）

- feature branch → PR → merge の運用を徹底する
- main への直接コミットは避け、変更・レビュー・CI と release commit の対応を PR で追跡可能にする
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

`/release` コマンドは 4 フェーズで構成される:

以下は Local CLI 経路。Actions は Phase 1–3 を version PR → exact-main CI → Start Release に置き換え、Phase 4 に合流する。

1. Phase 1: Pre-checks + Version Choice — ブランチ、ワークツリー、`origin/main` との一致、現在バージョン、bump 種別を確認
2. Phase 2: Changes + Release Notes — 5 つの version owner、`CHANGELOG.md`、リリースノート、該当する `todo.txt` を更新
3. Phase 3: Commit + Tag + Push — release commit、annotated tag、preflight、atomic push、draft Release ノート反映と workflow trigger の確認
4. Phase 4: Build Wait + Publish — 対応する `release.yml` run の成功とアーティファクトを検証して draft を解除

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

#### 喪失時（秘密鍵が手元にない）

- 既存ユーザーへの自動更新配信が不可能になる
- 新しい鍵ペアで署名した新バージョンを GitHub Release に配布し、全ユーザーへ手動再インストールを案内する
- 再インストール後は新公開鍵が焼き込まれるため、以降のリリースで自動更新が再開する

#### 漏洩時（秘密鍵が第三者に知られた可能性がある）

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
- Linux updater と既定ユーザーへの配信。packaging 自体は `workflow_dispatch` の `build_linux=true` で optional job として実装済みだが、`latest.json` は macOS / Windows 限定のまま。updater 契約の正本は `docs/release-manual-verification.md` の `2g. Optional Linux Packaging Verification`
