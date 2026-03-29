# Ultra RSS Reader — TODO

## コマンドパレット

- [ ] コマンドパレット（⌘K）でフィード/記事/設定への素早いアクセス + アクション実行

## ワイドスクリーン / フルスクリーン記事ビュー

- [ ] フィード編集ダイアログに表示モード設定（フィード単位でワイドスクリーン ON/OFF）
- [ ] 記事ビューアクションメニューにワイドスクリーン/フルスクリーン切替ボタン
- [ ] Settings > Reading にデフォルト表示モード設定（通常/ワイド/フルスクリーン）

## アプリアイコン設定

- [x] アプリアイコンの作成・設定（PR #10）
- [ ] ライトモード対応（OS テーマに応じたアイコン切替） #11

## 設定の未実装項目

設定 UI に表示されているが、アプリの動作に反映されていない項目。

### General

- [x] `unread_badge` — アプリアイコンの未読バッジ表示（Dock バッジ）
- [x] `sort_subscriptions` — サイドバーのフィード並び順（folders_first / alphabetical / newest / oldest）
- [x] `mark_article_as_read` — 既読マークのタイミング制御（on_open / manual）

### Appearance

- [x] `list_selection_style` — 記事リストの選択スタイル（Modern / Classic）
- [x] `layout` — レイアウト設定（Automatic / Wide / Compact）
- [x] `opaque_sidebars` — サイドバーの不透明化
- [x] `grayscale_favicons` — favicon のグレースケール表示
- [x] `font_style` — アプリ全体のフォントファミリー切り替え
- [x] `font_size` — アプリ全体のフォントサイズ変更
- [x] `show_starred_count` — サイドバーのスター付き件数表示
- [x] `show_all_count` — 削除（「All」ビューがサイドバーに存在しないため不要）

### Reading

- [x] `reader_view` — リーダービュー機能
- [x] `reading_sort` — 記事閲覧時のソート順（`sort_unread` のフォールバック）

## リリース運用

- [x] v0.3.0 リリースノートを手動反映
- [x] feature branch → PR → merge の運用（`release.yml` テンプレ + labeler 導入済み）
- [x] PR 作成時にラベル自動付与の仕組み導入（actions/labeler）
