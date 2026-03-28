---
allowed-tools: Bash, Read, Edit, Glob, Grep
description: "Release: version bump, tag, push, trigger GitHub Release workflow"
---

# Release Command

バージョンを bump し、タグを作成して push する。GitHub Actions の release workflow が発火してクロスプラットフォームビルド + ドラフト GitHub Release が作成される。

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

### 5. コミット

変更された4ファイルをステージして以下のメッセージでコミット:

```text
release: v{new_version}
```

### 6. タグ作成

```bash
git tag v{new_version}
```

### 7. ユーザー確認

push 前に以下を表示してユーザーの確認を求める:

- 旧バージョン → 新バージョン
- コミットハッシュ
- タグ名
- "push してよいですか？" と確認

### 8. push

ユーザーが承認したら:

```bash
git push origin main --follow-tags
```

これにより既存の `.github/workflows/release.yml` が `v*` タグで発火する。

### 9. 完了報告

- push したコミットとタグを報告
- GitHub Actions のワークフロー URL を表示（`gh run list --workflow=release.yml --limit=1`）
- ドラフト Release が作成されたら、GitHub でリリースノートを確認・編集して Publish する旨を案内
