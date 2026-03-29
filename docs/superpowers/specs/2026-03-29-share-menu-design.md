# Share Menu Design

## Summary

記事詳細ペインのツールバー右上に共有メニューボタンを追加する。
Base UI の Menu コンポーネントでポップオーバーを表示し、共有系アクションをグルーピングする。

## Motivation

現在のツールバーは個別ボタンがフラットに並んでいる。共有系アクション（リンクコピー、Reading List、メール共有）を1つのメニューにまとめることで、ツールバーを整理しつつ拡張性を確保する。

## Scope

- 共有メニューの UI 表示が主目的（「表示できる」がゴール）
- AirDrop、ブラウザ転送系は対象外
- Rust 側の変更なし（既存コマンドで対応可能）

## Design

### UI

- ツールバー右端に `Share` アイコン（lucide-react）のボタンを追加
- クリックで Base UI `Menu` コンポーネントのポップオーバーを表示
- スタイルは既存の `contextMenuStyles`（popup, item, separator）を流用
- 記事未選択時はボタンを `disabled` にする（既存パターン: `disabled={!article?.url}`）

### Menu Items

| Item                | Icon           | Action                                        | Visibility |
| ------------------- | -------------- | --------------------------------------------- | ---------- |
| Copy Link           | `Copy`         | `copyToClipboard(article.url)`                | Always     |
| Add to Reading List | `BookmarkPlus` | `addToReadingList(article.url)`               | macOS only |
| Share via Email     | `Mail`         | `openInBrowser(mailto:?subject=...&body=...)` | Always     |

### Implementation

1. `article-view.tsx` の `ArticleToolbar` に Base UI Menu を追加
2. メール共有は TS 側で `mailto:` URL を組み立て、既存 `openInBrowser` で開く
   - `subject` と `body` は `encodeURIComponent()` でエンコードする（`&`, `=`, `#` 等の特殊文字対策）
3. preferences に `action_share_menu` フラグを追加（表示/非表示制御）
4. `actions-settings.tsx` に共有メニューのトグルを追加

### i18n

以下のキーを追加する:

- `reader.json`: `share`, `share_via_email`, `added_to_reading_list`
- `settings.json`: `actions.share_menu`

既存の `copy_link`, `link_copied`, `open_in_external_browser` はそのまま流用。

### Platform Detection

- `@tauri-apps/plugin-os` は未導入のため、新規追加はしない
- Rust 側 `add_to_reading_list` は非 macOS でエラーを返す設計になっているため、TS 側ではエラーハンドリングで対応する（呼び出して失敗したら toast でメッセージ表示）
- 将来的に macOS 以外で非表示にしたい場合は `@tauri-apps/plugin-os` の導入を検討

### Menu Bar との整合性

- Rust 側 `menu.rs` に既に Share サブメニュー（Copy Link, Open in Browser, Add to Reading List）が存在
- 今回追加するポップオーバーメニューはこのメニューバーの Share と同等の役割
- メニューバーのイベントは `menu-action` 経由で既存の `keyboardEvents` にマッピング済み（`share-copy-link` → `copy-link` 等）
- ポップオーバーからも同じハンドラーを呼び出すことで動作を統一する

## Out of Scope

- AirDrop 連携
- ブラウザ固有の転送機能
- OS ネイティブ共有シート
- `@tauri-apps/plugin-os` の導入
