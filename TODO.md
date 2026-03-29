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

- [ ] `unread_badge` — アプリアイコンの未読バッジ表示（Dock バッジ等）
- [ ] `sort_subscriptions` — サイドバーのフィード並び順（folders_first / alphabetical / newest / oldest）
- [ ] `mark_article_as_read` — 既読マークのタイミング制御（on_open / manual）。現在は `after_reading` のみ機能

### Appearance

- [ ] `list_selection_style` — 記事リストの選択スタイル（Modern / Classic）
- [ ] `layout` — レイアウト設定（Automatic / Wide / Compact）。現在はウィンドウ幅で自動決定のみ
- [ ] `opaque_sidebars` — サイドバーの不透明化
- [ ] `grayscale_favicons` — favicon のグレースケール表示
- [ ] `font_style` — アプリ全体のフォントファミリー切り替え
- [ ] `font_size` — アプリ全体のフォントサイズ変更
- [ ] `show_starred_count` — サイドバーのスター付き件数表示
- [ ] `show_all_count` — サイドバーの全件数表示

### Reading

- [ ] `reader_view` — リーダービュー機能
- [ ] `reading_sort` — 記事閲覧時のソート順（`sort_unread` とは別キー）

## リリース運用

- [x] v0.3.0 リリースノートを手動反映
- [ ] 今後は feature branch → PR → merge の運用に切り替え（`generateReleaseNotes` + `release.yml` テンプレ活用）
- [ ] PR 作成時にラベル自動付与の仕組み導入（actions/labeler 等）
