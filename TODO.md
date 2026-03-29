# Ultra RSS Reader — TODO

## コマンドパレット

- [ ] コマンドパレット（⌘K）でフィード/記事/設定への素早いアクセス + アクション実行

## ブラウザビュー

- [ ] iframe 埋め込み拒否（X-Frame-Options / CSP）の記事を開いたとき、`chrome-error://chromewebdata/` を見せず外部ブラウザ誘導のフォールバック UI を出す

## ワイドスクリーン / フルスクリーン記事ビュー

- [x] フィード編集ダイアログに表示モード設定（フィード単位でワイドスクリーン ON/OFF）
- [x] ワイドスクリーンモード: サイドバー非表示、記事リスト＋ブラウザビュー2ペイン構成
- [ ] 記事ビューアクションメニューにワイドスクリーン/フルスクリーン切替ボタン
- [ ] Settings > Reading にデフォルト表示モード設定（通常/ワイド/フルスクリーン）

## アプリアイコン設定

- [x] アプリアイコンの作成・設定（PR #10）
- [ ] ライトモード対応（OS テーマに応じたアイコン切替） #11

## フォーム要素の Base UI 移行

ネイティブ HTML フォーム要素を Base UI プリミティブに統一する。

- [x] `src/components/ui/input.tsx` — Base UI Input ラッパー作成
- [x] 全 `<input>` を Input コンポーネントに置換（13箇所）
- [x] `src/components/ui/select.tsx` — Base UI Select compound component 作成
- [x] SettingsSelect を Base UI Select に移行（設定画面全体に波及）
- [x] 残りの `<select>` を個別移行（account-detail, add-account-form, add-feed-dialog, rename-feed-dialog）
- [x] Radio → Base UI RadioGroup 移行（add-feed-dialog）

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
