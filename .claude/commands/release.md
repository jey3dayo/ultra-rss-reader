---
allowed-tools: Bash, Read, Edit, Glob, Grep
description: "Release: version bump, release notes, tag, push, trigger GitHub Release workflow"
---

# Release Command

バージョンを bump し、リリースノートを自動生成し、タグを作成して push する。
GitHub Actions の release workflow が発火してクロスプラットフォームビルド + ドラフト GitHub Release が作成される。

## 引数

$ARGUMENTS (patch, minor, major のいずれか。省略時は対話で選択)

## 実行フロー

**3フェーズ構造。各フェーズ内は一括実行し、フェーズ間でユーザー確認を挟む。ステップを飛ばさないこと。**

---

### Phase 1: 事前チェック＋バージョン決定

以下をすべて実行し、1つでも失敗したら中止して理由を報告する:

1. 現在のブランチが `main` であること (`git branch --show-current`)
2. `git fetch origin main` でリモート最新化し、ローカルが `origin/main` と一致すること (`git rev-parse HEAD` と `git rev-parse origin/main` を比較。behind している場合はエラー終了)
3. uncommitted changes がないこと (`git status --porcelain` が空)
4. `mise run check` が成功すること（format + lint + test）
5. `package.json` から現在のバージョンを読み取る

**🔸 ユーザー確認①:** bump 種別を選択（patch / minor / major）。$ARGUMENTS で指定済みならスキップ。

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

**コミットログ収集:**

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

**コミットをカテゴリ分類:**

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

**対象コミットが 0 件の場合はエラーとして中止し、理由を報告する。**

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

**🔸 ユーザー確認②:** 生成されたリリースノートを表示し、内容を確認してもらう。修正指示があれば反映する。

---

### Phase 3: コミット＋タグ＋公開

#### 3a. コミット＋タグ作成

1. 変更されたファイルをステージしてコミット:

```text
release: v{new_version}
```

2. annotated タグを作成する:

```bash
git tag -a v{new_version} -m "v{new_version}"
```

**🔸 ユーザー確認③:** push 前に以下を表示してユーザーの確認を求める:

- 旧バージョン → 新バージョン
- リリースノート（カテゴリ分類済み）
- コミットハッシュ
- タグ名
- "push してよいですか？" と確認

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

**責務分担:** CLI がリリースノート本文を管理し、`release.yml` の `tauri-action` はアーティファクト添付のみを担当する。

#### 3d. 完了報告

- push したコミットとタグを報告
- GitHub Actions のワークフロー URL を表示（`gh run list --workflow=release.yml --limit=1`）
- GitHub Release URL を表示
- ドラフト Release のリリースノートを確認し、問題なければ Publish する旨を案内
