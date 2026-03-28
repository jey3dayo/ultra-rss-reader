---
allowed-tools: Bash, Read, Edit, Glob, Grep
description: "Release: version bump, release notes generation, tag, push, trigger GitHub Release workflow"
---

# Release Command

バージョンを bump し、リリースノートを自動生成し、タグを作成して push する。GitHub Actions の release workflow が発火してクロスプラットフォームビルド + ドラフト GitHub Release が作成される。

## 引数

$ARGUMENTS (patch, minor, major のいずれか。省略時は patch)

## 手順

### 1. 事前チェック

以下をすべて確認し、1つでも失敗したら中止して理由を報告する:

- 現在のブランチが `main` であること (`git branch --show-current`)
- uncommitted changes がないこと (`git status --porcelain` が空)
- `mise run check` が成功すること（format + lint + test）

### 2. 現在バージョンの取得

`package.json` から現在のバージョンを読み取る。

### 3. バージョン bump

引数（デフォルト: patch）に基づいて新しいバージョンを計算し、以下の3ファイルを更新する:

- `package.json` — `"version": "x.y.z"`
- `src-tauri/Cargo.toml` — `version = "x.y.z"`（`[package]` セクション内）
- `src-tauri/tauri.conf.json` — `"version": "x.y.z"`

### 4. Cargo.lock 更新

```bash
cd src-tauri && cargo check
```

で Cargo.lock にバージョン変更を反映する。

### 5. リリースノート自動生成

前回のタグから現在までのコミットログを分析し、リリースノートを生成する。

#### 5a. コミットログ収集

```bash
git log {previous_tag}..HEAD --oneline --no-merges
```

前回のタグは `git describe --tags --abbrev=0 HEAD~1` で取得する。タグがない場合は全コミットを対象とする。

#### 5b. コミットをカテゴリ分類

コミット prefix に基づいて以下のカテゴリに分類する:

| prefix                       | カテゴリ            |
| ---------------------------- | ------------------- |
| `feat:`                      | 🚀 Features         |
| `fix:`                       | 🐛 Bug Fixes        |
| `docs:`                      | 📚 Documentation    |
| `chore:`/`refactor:`/`test:` | 🔧 Maintenance      |
| (breaking change)            | 💥 Breaking Changes |

- `release:`, `merge:` prefix のコミットは除外する
- PR 番号（`(#N)`）があればそのまま含める
- 空のカテゴリはセクションごと省略する

#### 5c. リリースノートテキスト生成

以下の形式で生成する:

```markdown
## 🚀 Features

- macOS ネイティブメニューバー (#6)
- ...

## 🐛 Bug Fixes

- ...
```

生成したテキストをユーザーに表示し、内容を確認してもらう。修正指示があれば反映する。

### 6. CHANGELOG.md 更新

`CHANGELOG.md` の `## [Unreleased]` セクションの直後に新バージョンのセクションを追加する:

```markdown
## [Unreleased]

## [{new_version}] - {YYYY-MM-DD}

### Features

- ...

### Bug Fixes

- ...
```

- カテゴリ名は CHANGELOG 形式に合わせる（絵文字なし: Features, Bug Fixes, Documentation, Maintenance）
- 空のカテゴリは省略する

### 7. TODO.md 更新

`TODO.md` にリリース関連の完了タスクがあれば `[x]` にマークする。該当がなければスキップ。

### 8. コミット

変更されたファイル（バージョン 3 ファイル + Cargo.lock + CHANGELOG.md + TODO.md）をステージして以下のメッセージでコミット:

```text
release: v{new_version}
```

### 9. タグ作成

annotated タグを作成する（`--follow-tags` で push されるために必要）:

```bash
git tag -a v{new_version} -m "v{new_version}"
```

### 10. ユーザー確認

push 前に以下を表示してユーザーの確認を求める:

- 旧バージョン → 新バージョン
- リリースノート（カテゴリ分類済み）
- コミットハッシュ
- タグ名
- "push してよいですか？" と確認

### 11. push

ユーザーが承認したら:

```bash
git push origin main --follow-tags
```

push 後、タグがリモートに存在するか確認する:

```bash
git ls-remote --tags origin | grep v{new_version}
```

もしタグが見つからない場合は明示的に push する:

```bash
git push origin v{new_version}
```

これにより既存の `.github/workflows/release.yml` が `v*` タグで発火する。

### 12. GitHub Release ノート反映

ドラフト Release が作成されたら、ステップ 5 で生成したリリースノートを GitHub Release の body に反映する:

```bash
gh release edit v{new_version} --notes "..."
```

PR ベースの `generateReleaseNotes` が空になる場合があるため（直接コミット時）、常にコミットログベースのノートで上書きする。

### 13. 完了報告

- push したコミットとタグを報告
- GitHub Actions のワークフロー URL を表示（`gh run list --workflow=release.yml --limit=1`）
- GitHub Release URL を表示
- ドラフト Release のリリースノートを確認し、問題なければ Publish する旨を案内
