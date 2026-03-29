# Release Command Redesign

## 背景

現行の `/release` コマンドは13ステップの逐次実行で、実行時にステップを飛ばしやすい。実際に以下の問題が発生した:

- lightweight タグが `--follow-tags` で push されなかった
- リリースノート生成・CHANGELOG 更新をスキップした
- GitHub Release ノートが空のままだった

## 設計方針

- **3フェーズ構造**: ステップをフェーズにまとめ、フェーズ内は一括実行
- **3回のユーザー確認**: bump 種別選択、リリースノート確認、push 前確認
- **コミットログベース**: リリースノートは PR ではなくコミットログから生成
- **安全なタグ push**: annotated タグ + push 後の到達確認

## フェーズ構成

### Phase 1: 事前チェック＋バージョン決定

以下を一括実行する:

1. 現在のブランチが `main` であることを確認
2. uncommitted changes がないことを確認
3. `mise run check` を実行（format + lint + test）
4. `package.json` から現在のバージョンを取得

**ユーザー確認①:** bump 種別を選択（patch / minor / major）。引数で指定済みならスキップ。

### Phase 2: 変更生成＋リリースノート

以下を一括実行する:

1. 3ファイルのバージョン bump
   - `package.json` — `"version": "x.y.z"`
   - `src-tauri/Cargo.toml` — `version = "x.y.z"`（`[package]` セクション内）
   - `src-tauri/tauri.conf.json` — `"version": "x.y.z"`
2. `cd src-tauri && cargo check` で Cargo.lock 更新
3. コミットログからリリースノート生成
4. CHANGELOG.md 更新
5. TODO.md 更新（該当タスクがあれば `[x]` にマーク）

**ユーザー確認②:** 生成されたリリースノートを表示し、修正指示があれば反映。

### Phase 3: コミット＋タグ＋公開

以下を一括実行する:

1. 変更ファイルをステージしてコミット: `release: v{version}`
2. annotated タグ作成: `git tag -a v{version} -m "v{version}"`

**ユーザー確認③:** push 前サマリーを表示:

- 旧バージョン → 新バージョン
- リリースノート（カテゴリ分類済み）
- コミットハッシュ
- タグ名

承認後:

3. `git push origin main --follow-tags`
4. `git ls-remote --tags origin | grep v{version}` でタグ到達確認。不在なら `git push origin v{version}`
5. `gh release edit v{version} --notes "..."` でリリースノート反映
6. 完了報告: コミット、タグ、GitHub Actions ワークフロー URL

## リリースノート生成ルール

### コミットログ収集

```bash
git log {previous_tag}..HEAD --oneline --no-merges
```

前回タグは `git describe --tags --abbrev=0 HEAD~1` で取得。タグがない場合は全コミットを対象。

### カテゴリ分類

| prefix                             | GitHub Release カテゴリ | CHANGELOG カテゴリ |
| ---------------------------------- | ----------------------- | ------------------ |
| `feat:`                            | 🚀 Features             | Features           |
| `fix:`                             | 🐛 Bug Fixes            | Bug Fixes          |
| `docs:`                            | 📚 Documentation        | Documentation      |
| `chore:`/`refactor:`/`test:`/`ci:` | 🔧 Maintenance          | Maintenance        |
| breaking change                    | 💥 Breaking Changes     | Breaking Changes   |

### 除外ルール

- `release:`, `merge:` prefix のコミットは除外
- PR 番号（`(#N)`）があればそのまま含める
- 空のカテゴリはセクションごと省略

### CHANGELOG.md 更新形式

```markdown
## [Unreleased]

## [{version}] - {YYYY-MM-DD}

### Features

- ...
```

`[Unreleased]` の直後に新バージョンセクションを挿入。カテゴリ名は絵文字なし。

### GitHub Release 更新形式

絵文字付きカテゴリで `gh release edit v{version} --notes "..."` に反映。

## ステップ飛ばし防止

- フェーズ内のステップは「一括実行」として記述（個別ステップの列挙ではない）
- 各フェーズ末尾のユーザー確認が次フェーズへのゲート
- フェーズ間の依存を明示（Phase 2 は Phase 1 の bump 種別を使う等）

## タグ push の安全策

- `git tag -a -m` で annotated タグを作成（`--follow-tags` 対応）
- push 後に `git ls-remote --tags` でリモート到達を確認
- 不在時は `git push origin v{version}` でフォールバック
