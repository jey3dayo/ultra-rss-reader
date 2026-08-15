---
allowed-tools: Bash, Read, Edit, Glob, Grep
description: "Release: version bump, release notes, tag, push, trigger GitHub Release workflow, wait for build, publish"
---

# Release Command

バージョンを bump し、リリースノートを生成し、タグを作成して push する。
GitHub Actions の release workflow がクロスプラットフォームビルド + ドラフト GitHub Release を作成する。
ビルド完了を待ってアーティファクトを検証し、Release を publish するまでが既定の完了地点。

品質ゲートは lefthook に委譲する: `git push` 時に pre-push フック（format:check / lint / test:unit:ci / test:rust / build）が自動実行されるため、このコマンド内では事前チェックを重複実行しない。リリース固有の検証（version parity・release contamination）だけ `release:preflight:local` で行う。

## 引数

$ARGUMENTS (patch / minor / major。省略時は patch。ただしコミット分析で minor/major が適切と判断した場合は提案して確認する)

## 承認モデル

- `/release` の実行自体を公開意図の承認とみなし、commit・push・publish まで途中確認なしで進める。
- 停止して確認するのは次の場合のみ:
  - 必須チェック（事前条件、preflight、pre-push フック、ビルド）の失敗
  - 期待アーティファクトの欠落
  - semver prerelease タグ（`vX.Y.Z-alpha.1` 等）
  - ユーザーが「draft のみ」「publish しない」を明示した場合
  - bump 種別の提案（引数省略時に minor/major が適切なケース）
- 引数で bump 種別が明示されていれば、コミット内容に関わらずそのまま使う。
- 失敗時はその時点で停止して報告し、ユーザーの修正指示をまたいで承認を持ち越さない。

## Phase 1: 事前条件＋バージョン決定

1つでも失敗したら中止して理由を報告する:

1. 現在のブランチが `main`（`git branch --show-current`）
2. `git fetch origin main` 後、ローカル HEAD が `origin/main` と一致（behind ならエラー終了）
3. uncommitted changes（`git status --porcelain`）:
   - 空なら続行。
   - リリース対象として意図された作業内容（直前の会話での修正など）なら、先に適切な conventional commit でコミットして続行。
   - 無関係または意図不明なら中止して内容を報告。
4. `package.json` から現在のバージョンを読み取る。
5. bump 種別の決定: 引数指定があればそれを使う。未指定なら前回タグ以降のコミットを分析し、`feat:` があれば minor、`!` 付きがあれば major を提案して確認。それ以外は patch のまま続行。

## Phase 2: 変更生成＋リリースノート

以下を一括実行する:

### 2a. バージョン更新

新バージョンで3ファイルを更新し、`cd src-tauri && cargo check` で `Cargo.lock` も更新する:

- `package.json`
- `src-tauri/Cargo.toml`（`[package]` の `version`）
- `src-tauri/tauri.conf.json`

### 2b. リリースノート生成

```bash
PREV_TAG=$(git describe --tags --abbrev=0 --match "v*" 2>/dev/null)
git log ${PREV_TAG:+${PREV_TAG}..}HEAD --oneline --no-merges
```

対象コミットが 0 件ならエラーとして中止する（バージョン bump は未コミットなので対象外で正しい）。

カテゴリ分類:

| prefix                                                | GitHub Release カテゴリ | CHANGELOG カテゴリ |
| ----------------------------------------------------- | ----------------------- | ------------------ |
| `feat:`                                               | 🚀 Features             | Features           |
| `fix:`                                                | 🐛 Bug Fixes            | Bug Fixes          |
| `docs:`                                               | 📚 Documentation        | Documentation      |
| `!` 付き（`feat!:` 等）                               | 💥 Breaking Changes     | Breaking Changes   |
| その他（`chore:`, `refactor:`, prefix なし等）        | 🔧 Maintenance          | Maintenance        |

- `release:` / `merge:` コミットは除外。PR 番号（`(#N)`）はそのまま含める。空カテゴリは省略。

### 2c. CHANGELOG.md 更新

`## [Unreleased]` の直後に `## [{new_version}] - {YYYY-MM-DD}` セクション（絵文字なしカテゴリ）を挿入し、`[Unreleased]` の既存内容は空にする。`[Unreleased]` がなければヘッダー直後に両方を挿入する。

### 2d. todo.txt 更新

リリース内容に対応するタスクがあれば `tuxedo done` → `archive`（対応 GitHub issue はクローズ）。該当なしならスキップ。

生成したリリースノートを表示し、確認を待たずに Phase 3 へ進む。

## Phase 3: コミット＋タグ＋push

### 3a. コミット＋タグ＋preflight

1. 変更をステージして `release: v{new_version}` でコミット。
2. `git rev-parse HEAD` を記録し、annotated タグを作成: `git tag -a v{new_version} -m "v{new_version}"`
3. push 前検証（失敗したら中止）:

```bash
git rev-list -n 1 v{new_version}   # release commit hash と一致すること
RELEASE_TAG=v{new_version} mise run release:preflight:local
```

`release:preflight:local` は通常の commit hook ではなく、release commit と annotated tag を作った後、push 直前だけに実行するリリース固有の検証（version parity、release build contamination）ゲート。format / lint / test は pre-push フックでも走る。

push 前に「旧→新バージョン、リリースノート、コミットハッシュ、タグ名」を表示し、確認を待たずに続行する。

### 3b. push

```bash
git push --atomic origin main v{new_version}
```

この push で lefthook pre-push フックが走る。フック失敗時は中止して報告する。

push 後、タグの到達を確認し、なければ明示 push する:

```bash
git ls-remote --tags origin | grep "refs/tags/v{new_version}$" || git push origin v{new_version}
```

### 3c. GitHub Release ノート反映

`gh release edit v{new_version} --notes "..."`（絵文字付きカテゴリ）。Release 未作成（Actions 未完了）なら `gh release create v{new_version} --draft --notes "..."` で先にドラフト作成する。

責務分担: リリースノート本文は CLI が管理し、`release.yml` の `tauri-action` はアーティファクト添付のみ。workflow は常に draft を作り、semver prerelease タグのみ `prerelease=true` にする。

### 3d. push 後報告

コミット・タグ・workflow run URL（`gh run list --workflow=release.yml --limit=1`）・ドラフト Release URL を報告し、確認を待たずに Phase 4 へ進む。

## Phase 4: ビルド完了待ち＋publish

### 4a. 対象 run の特定

```bash
gh run list --workflow=release.yml --limit=5 --json databaseId,headSha,status,conclusion
```

`headSha` が release commit hash と一致する run を対象にする。見つからなければ run 登録前の可能性があるため短時間待って再取得する。

### 4b. ビルド完了待ち

`gh run watch <run-id> --exit-status` で待つ（長時間なら分割監視可）。`conclusion` が `success` 以外なら publish せず中止し、失敗ジョブと URL を報告する。fix-forward はユーザー判断。

### 4c. アーティファクト検証

```bash
gh release view v{new_version} --json isDraft,isPrerelease,assets --jq '{isDraft,isPrerelease,assetCount:(.assets|length),assets:[.assets[].name]}'
```

- 各プラットフォームのインストーラ（macOS `.dmg` / `.app.tar.gz`、Windows `.exe` / `.msi`）を確認。
- updater 構成（`tauri.conf.json` に `plugins.updater`）なら `latest.json` と各 `.sig` も確認。
- 欠落があれば publish せず報告する。

### 4d. publish

停止条件に該当しなければ draft を解除し、`isDraft=false` を確認する:

```bash
gh release edit v{new_version} --draft=false --latest
# semver prerelease の場合: gh release edit v{new_version} --draft=false --prerelease
gh release view v{new_version} --json isDraft,isPrerelease,publishedAt,url --jq '{isDraft,isPrerelease,publishedAt,url}'
```

### 4e. 完了報告

- publish 済み Release URL と `isDraft` / `isPrerelease`
- ビルド run の結論と URL
- 添付アーティファクト件数と主要インストーラ名
- updater 構成なら `latest.json` 公開により自動更新が有効になった旨
