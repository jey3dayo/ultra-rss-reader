---
allowed-tools: Bash, Read, Edit, Glob, Grep
description: "Release: version bump, release notes, tag, push, trigger GitHub Release workflow, wait for build, publish"
---

# Release Command

バージョンを bump し、リリースノートを自動生成し、タグを作成して push する。
GitHub Actions の release workflow が発火してクロスプラットフォームビルド + ドラフト GitHub Release が作成される。
ビルド完了を待ってアーティファクトを検証し、Release を publish するところまでを既定の完了地点とする。

## 引数

$ARGUMENTS (patch, minor, major のいずれか。省略時は対話で選択)

## 実行フロー

### 4フェーズ構造。各フェーズ内は一括実行し、未承認の判断だけ確認する。ステップを飛ばさないこと

### 承認モデル

- 有効な bump 種別と公開意図（`push`, `publish`, `tag`, `release`, `最後まで`, `リリースして` など）が同じ依頼内にある場合、必須チェック通過後に Phase 1-4 を進めてよい。publish は release フローの既定の終点であり、公開意図が承認済みなら Phase 4 の publish まで追加確認なしで実行する。
- 途中の返答が `OK`, `push`, `publish`, `進めて`, `そのまま` などの場合、その返答の意図に一致する残りのステップは承認済みとして扱う。
- bump 種別が未指定または不正な場合だけ確認する。
- リリースノート確認は、公開意図が未承認の場合、または生成内容に曖昧さがあり公開前確認が必要な場合だけ停止する。公開意図が承認済みなら Phase 2 後に要約を表示して待たずに続行する。
- push 確認は、公開意図が未承認の場合だけ行う。
- publish は、公開意図が承認済みで、かつビルドが success かつ期待アーティファクトが添付済みのときに自動実行する。次の場合は publish せずドラフトのまま停止して報告する: 公開意図が未承認、ビルドが失敗またはタイムアウト、アーティファクト未添付、semver prerelease tag で手動確認が必要、ユーザーが `draft のみ` / `publish しない` を明示。
- 失敗したチェック、dirty working tree、ブランチ不一致、バージョン不一致、想定外の生成ファイル、ビルド失敗、ユーザーの修正指示をまたいで承認を持ち越さない。

---

### Phase 1: 事前チェック＋バージョン決定

以下をすべて実行し、1つでも失敗したら中止して理由を報告する:

1. 現在のブランチが `main` であること (`git branch --show-current`)
2. `git fetch origin main` でリモート最新化し、ローカルが `origin/main` と一致すること (`git rev-parse HEAD` と `git rev-parse origin/main` を比較。behind している場合はエラー終了)
3. uncommitted changes がないこと (`git status --porcelain` が空)
4. `mise run check` が成功すること（format + lint + test）
5. `package.json` から現在のバージョンを読み取る

🔸 ユーザー確認①: bump 種別を選択（patch / minor / major）。$ARGUMENTS や依頼文で指定済みならスキップ。

---

### Phase 2: 変更生成＋リリースノート

以下を一括実行する:

#### 2a. バージョン bump

引数に基づいて新しいバージョンを計算し、以下の3ファイルを更新する:

- `package.json` — `"version": "x.y.z"`
- `src-tauri/Cargo.toml` — `version = "x.y.z"`（`[package]` セクション内）
- `src-tauri/tauri.conf.json` — `"version": "x.y.z"`

#### 2b. Cargo.lock 更新

```bash
cd src-tauri && cargo check
```

#### 2c. リリースノート生成

前回のタグから現在までのコミットログを分析する。

### コミットログ収集

```bash
# 前回タグ取得（v* パターンでリリースタグのみ）
PREV_TAG=$(git describe --tags --abbrev=0 --match "v*" 2>/dev/null)

# コミットログ取得
if [ -n "$PREV_TAG" ]; then
  git log ${PREV_TAG}..HEAD --oneline --no-merges
else
  # 初回リリース: 全コミット
  git log --oneline --no-merges
fi
```

### コミットをカテゴリ分類

| prefix                                                | GitHub Release カテゴリ | CHANGELOG カテゴリ |
| ----------------------------------------------------- | ----------------------- | ------------------ |
| `feat:`                                               | 🚀 Features             | Features           |
| `fix:`                                                | 🐛 Bug Fixes            | Bug Fixes          |
| `docs:`                                               | 📚 Documentation        | Documentation      |
| `chore:`/`refactor:`/`test:`/`ci:`                    | 🔧 Maintenance          | Maintenance        |
| `feat!:`/`fix!:` 等 (`!` 付き)                        | 💥 Breaking Changes     | Breaking Changes   |
| その他（prefix なし、`perf:`, `build:`, `style:` 等） | 🔧 Maintenance          | Maintenance        |

- `release:`, `merge:` prefix のコミットは除外する
- PR 番号（`(#N)`）があればそのまま含める
- 空のカテゴリはセクションごと省略する

### 対象コミットが 0 件の場合はエラーとして中止し、理由を報告する

注: バージョン bump はまだ未コミットのため、リリースノートの対象には含まれない（意図通り）。

#### 2d. CHANGELOG.md 更新

`## [Unreleased]` の直後に新バージョンセクションを挿入し、`[Unreleased]` 内の既存内容は空にする:

```markdown
## [Unreleased]

## [{new_version}] - {YYYY-MM-DD}

### Features

- ...
```

カテゴリ名は絵文字なし。`[Unreleased]` が見つからない場合は、ファイルヘッダー直後に `## [Unreleased]` + 新バージョンセクションの両方を挿入する。

#### 2e. TODO.md 更新

リリースに含まれる内容に対応するタスクがあれば `[x]` にマーク。該当なしならスキップ。

🔸 リリースノート確認: 生成されたリリースノートを表示する。公開意図が承認済みで、内容がコミット履歴から明確なら待たずに Phase 3 へ進む。未承認または曖昧な場合だけ確認し、修正指示があれば反映する。

---

### Phase 3: コミット＋タグ＋公開

#### 3a. コミット＋タグ作成

1. 変更されたファイルをステージしてコミット:

```text
release: v{new_version}
```

1. `git rev-parse HEAD` で release commit hash を記録し、その commit に対して annotated タグを作成する:

```bash
git rev-parse HEAD
git tag -a v{new_version} -m "v{new_version}"
```

1. push 前に次をすべて確認する:

```bash
git rev-list -n 1 v{new_version}
git show v{new_version}:package.json
git show v{new_version}:src-tauri/Cargo.toml
git show v{new_version}:src-tauri/tauri.conf.json
RELEASE_TAG=v{new_version} mise run release:preflight:local
```

タグが release commit hash と一致しない、tag 先の 3 ファイルの version が `{new_version}` でない、または local release preflight が失敗した場合は中止する。

`release:preflight:local` は通常の commit hook ではなく、release commit と annotated tag を作った後、push 直前だけに実行する。GitHub Actions の artifact build 前 preflight をローカルで先取りし、version parity、release build contamination、format、TypeScript、CI unit tests を確認する。

🔸 push 前報告: push 前に以下を表示する。公開意図が未承認の場合だけ確認を求める:

- 旧バージョン → 新バージョン
- リリースノート（カテゴリ分類済み）
- コミットハッシュ
- タグ名
- 公開意図が未承認の場合は "push してよいですか？" と確認

#### 3b. push

ユーザーが承認したら:

```bash
# atomic push（branch + tag を同時に。片方だけ通る壊れた状態を防ぐ）
git push --atomic origin main v{new_version}
# --atomic 非対応の場合のフォールバック:
# git push origin main --follow-tags
```

push 後、タグがリモートに存在するか完全一致で確認する:

```bash
git ls-remote --tags origin | grep "refs/tags/v{new_version}$"
```

もしタグが見つからない場合は明示的に push する:

```bash
git push origin v{new_version}
```

#### 3c. GitHub Release ノート反映

`gh release edit v{new_version} --notes "..."` でリリースノート（絵文字付きカテゴリ）を反映する。

Release がまだ存在しない場合（GitHub Actions 未完了）は `gh release create v{new_version} --draft --notes "..."` で先にドラフト作成する。

責務分担: CLI がリリースノート本文を管理し、`release.yml` の `tauri-action` はアーティファクト添付のみを担当する。

workflow gate: `release.yml` はタグ対象コミットが checkout と一致し、かつ `origin/main` から到達可能であることを artifact 作成前に検証する。Release は常に draft とし、`v1.2.3-alpha.1` のような semver prerelease tag のみ `prerelease=true`、`v1.2.3+build.1` のような build metadata だけの tag は `prerelease=false` として扱う。

#### 3d. push 後報告

- push したコミットとタグを報告
- GitHub Actions のワークフロー URL を表示（`gh run list --workflow=release.yml --limit=1`）
- ドラフト GitHub Release URL を表示
- 公開意図が承認済みなら Phase 4 へ進む。未承認ならここで停止し、ドラフト確認後に publish する旨を案内する

---

### Phase 4: ビルド完了待ち＋公開（publish）

公開意図が承認済みの場合、release フローの終点として自動 publish する。承認モデルの publish 停止条件に該当する場合はドラフトのまま停止して報告する。

#### 4a. 対象 run の特定

```bash
gh run list --workflow=release.yml --limit=5 --json databaseId,headSha,status,conclusion
```

`headSha` が release commit hash と一致する run を対象にする。一致する run が見つからない場合は、tag push 直後で run 登録前のことがあるため、短時間待って再取得する。

#### 4b. ビルド完了待ち

```bash
gh run watch <run-id> --exit-status
```

- ビルドはクロスプラットフォームで長時間かかるため、必要なら分割して監視する（`gh run watch` を再実行、または `gh run view <run-id> --json status,conclusion`）。
- `conclusion` が `success` 以外（`failure` / `cancelled` / `timed_out`）の場合は publish せず中止し、失敗ジョブと URL を報告する。fix-forward はユーザー判断に委ねる。

#### 4c. アーティファクト検証

```bash
gh release view v{new_version} --json isDraft,isPrerelease,assets --jq '{isDraft,isPrerelease,assetCount:(.assets|length),assets:[.assets[].name]}'
```

- 各プラットフォームのインストーラ（macOS `.dmg` / `.app.tar.gz`、Windows `.exe` / `.msi`）が添付されていることを確認する。
- updater 構成（`tauri.conf.json` に `plugins.updater`）の場合は `latest.json` と各 `.sig` の添付も確認する。
- アセットが空、または期待アセットが欠落している場合は publish せず報告する。

#### 4d. publish

停止条件に該当しなければ draft を解除する:

```bash
# 安定版（通常の vX.Y.Z）
gh release edit v{new_version} --draft=false --latest
# semver prerelease tag（vX.Y.Z-alpha.1 など）を publish する場合
# gh release edit v{new_version} --draft=false --prerelease
```

publish 後に確定を確認する:

```bash
gh release view v{new_version} --json isDraft,isPrerelease,publishedAt,url --jq '{isDraft,isPrerelease,publishedAt,url}'
```

`isDraft` が `false` であることを確認する。

#### 4e. 完了報告

- publish 済みの Release URL と `isDraft=false` / `isPrerelease` を報告
- ビルド run の結論（success）と URL
- 添付アーティファクト件数と主要インストーラ名
- updater 構成の場合、`latest.json` 公開により自動更新が有効になった旨を明記
