# Release Command Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: `.claude/commands/release.md` を3フェーズ構造に書き換え、ステップ飛ばし・リリースノート漏れ・タグ push 失敗を根本的に防止する

Architecture: 既存コマンド定義ファイル1つを全面書き換え。加えて `release.yml` の `generateReleaseNotes` を無効化し、CLI 側にリリースノート責務を一本化する。`release-workflow.md` ルールファイルも新設計に同期させる。

Tech Stack: Claude Code slash command (Markdown), GitHub Actions (YAML), git

---

## File Structure

| File                                | Action  | Responsibility                                                        |
| ----------------------------------- | ------- | --------------------------------------------------------------------- |
| `.claude/commands/release.md`       | Rewrite | コマンド定義本体。3フェーズ構造に全面書き換え                         |
| `.github/workflows/release.yml`     | Modify  | `generateReleaseNotes: true` → `false` に変更（CLI 側が管理するため） |
| `.claude/rules/release-workflow.md` | Modify  | 新設計に合わせてルール更新                                            |

---

### Task 1: コマンド定義の書き換え

### Files

- Rewrite: `.claude/commands/release.md`

- [ ] **Step 1: 現行コマンド定義のバックアップ確認**

git 管理されているので追加バックアップは不要。現行内容を読んで理解する。

Read: `.claude/commands/release.md`

- [ ] **Step 2: コマンド定義を3フェーズ構造で書き換え**

`.claude/commands/release.md` を以下の構造で全面書き換える:

````markdown
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
````

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

🔸 ユーザー確認②: 生成されたリリースノートを表示し、内容を確認してもらう。修正指示があれば反映する。

---

### Phase 3: コミット＋タグ＋公開

#### 3a. コミット＋タグ作成

1. 変更されたファイルをステージしてコミット:

```text
release: v{new_version}
```

1. annotated タグを作成する:

```bash
git tag -a v{new_version} -m "v{new_version}"
```

🔸 ユーザー確認③: push 前に以下を表示してユーザーの確認を求める:

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

責務分担: CLI がリリースノート本文を管理し、`release.yml` の `tauri-action` はアーティファクト添付のみを担当する。

#### 3d. 完了報告

- push したコミットとタグを報告
- GitHub Actions のワークフロー URL を表示（`gh run list --workflow=release.yml --limit=1`）
- GitHub Release URL を表示
- ドラフト Release のリリースノートを確認し、問題なければ Publish する旨を案内

- [ ] **Step 3: 書き換えた内容を確認**

Read: `.claude/commands/release.md` で全文を確認し、旧ステップが残っていないこと、3フェーズ構造になっていることを検証。

- [ ] **Step 4: コミット**

```bash
git add .claude/commands/release.md
git commit -m "feat: redesign release command with 3-phase structure"
````

---

### Task 2: release.yml の generateReleaseNotes 無効化

### Files

- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: 現行の release.yml を確認**

Read: `.github/workflows/release.yml` で `generateReleaseNotes` の位置を確認。

- [ ] **Step 2: generateReleaseNotes を false に変更**

`.github/workflows/release.yml` の `tauri-action` 設定内:

```yaml
# Before:
generateReleaseNotes: true

# After:
generateReleaseNotes: false
```

これにより、`tauri-action` は Release のアーティファクト添付のみを行い、リリースノート本文は CLI 側の `gh release edit/create` が管理する。

- [ ] **Step 3: コミット**

```bash
git add .github/workflows/release.yml
git commit -m "ci: disable generateReleaseNotes in release workflow (CLI manages notes)"
```

---

### Task 3: release-workflow.md ルール更新

### Files

- Modify: `.claude/rules/release-workflow.md`

- [ ] **Step 1: 現行ルールを確認**

Read: `.claude/rules/release-workflow.md`

- [ ] **Step 2: 新設計に合わせてルールを更新**

以下を反映する:

- ビルドマトリクスの記述を更新（macOS arm64 + Windows の2並列）
- 「開発フロー」セクションに3フェーズ構造の概要を追加
- `generateReleaseNotes` 無効化の根拠を追記
- リリースノート責務分担（CLI = ノート本文、tauri-action = アーティファクト）を明記

- [ ] **Step 3: コミット**

```bash
git add .claude/rules/release-workflow.md
git commit -m "docs: update release-workflow rules for 3-phase command design"
```

---

### Task 4: 動作確認

- [ ] **Step 1: コマンド定義の構文確認**

`.claude/commands/release.md` の frontmatter が正しいことを確認:

- `allowed-tools` が設定されていること
- `description` が設定されていること
- Markdown が正しくレンダリングされること

- [ ] **Step 2: 全体の品質チェック**

```bash
mise run check
```

Markdown lint が通ることを確認。

- [ ] **Step 3: 最終コミット（必要な場合のみ）**

lint 修正があれば:

```bash
git add -A
git commit -m "fix: address lint issues in release command docs"
```
