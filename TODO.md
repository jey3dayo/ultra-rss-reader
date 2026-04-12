# Ultra RSS Reader — TODO

## 2026-04-10 画面巡回レビュー

- [x] Webプレビュー表示中の重複アクション露出を整理する
  - 問題: オーバーレイ表示中でも背面ツールバー側の `Webプレビューを閉じる` / `外部ブラウザで開く` が同時に露出し、スクリーンリーダー・音声操作・自動操作で対象が曖昧になる
  - 対象: `src/components/reader/article-view.tsx`, `src/components/reader/article-toolbar-view.tsx`, `src/components/reader/browser-view.tsx`
  - 計画:
    1. overlay 表示中は背面ツールバーの該当操作を `inert` / `aria-hidden` / 非表示のいずれかで単一導線に寄せる
    2. overlay 側のラベルも文脈付きにするか、少なくとも重複ラベルを減らす
    3. browser-mode と Tauri 実機の両方で開閉・フォーカス復帰を再確認する

- [x] Feed Cleanup の 3 カラム密度をラップトップ幅基準で調整する
  - 問題: `240px / 可変 / 340px` の固定配分が 1280px 前後だと窮屈で、確認ペインの説明とアクションが圧縮される
  - 対象: `src/components/feed-cleanup/feed-cleanup-page-view.tsx`
  - 計画:
    1. `lg` 1 本の切り替えではなく、中間幅用の 2 カラム or 可変カラム幅を追加する
    2. 右ペインの要約カードとアクション群を sticky / collapse などで再配置する
    3. `open-feed-cleanup` と `open-feed-cleanup-broken-references` の両シナリオで見え方を比較する

- [x] 記事詳細のタグ追加導線を見つけやすくする
  - 問題: 記事本文上部の `+` ボタンが孤立して見え、タグ機能の存在と役割に気づきにくい
  - 対象: `src/components/reader/article-view.tsx`, `src/components/reader/article-tag-picker-view.tsx`
  - 計画:
    1. 空状態でも「タグ」見出しか補助文を残して操作意図を明示する
    2. ボタン単体ではなく chip row / inline action として視覚的なまとまりを作る
    3. キーボードフォーカス時と hover 時の誘導も合わせて見直す

- [x] Settings モーダルの低いビューポートでの情報密度を見直す
  - 問題: 一般設定の下部項目が fold 下に沈みやすく、スクロール可能であることが弱く伝わる
  - 対象: `src/components/settings/settings-modal-view.tsx`, `src/components/settings/settings-page-view.tsx`
  - 計画:
    1. section spacing を少し圧縮して初期表示で見える情報量を増やす
    2. 下端グラデーションだけに頼らず、sticky 見出しや補助 affordance を検討する
    3. 1280x720 前後の高さで主要タブを一巡して再確認する

## UI/UX 監査の残り

- [ ] モバイル向け UI を正式対応する段階で、アイコンのみ導線の見直しを再開する
  - 現時点では mobile を主要提供面にしないため必須対応から外すが、狭い幅での discoverability 課題として保留する
  - 対応する場合は tooltip 前提の主要操作を、ラベル表示かメニュー集約で補う
  - 候補箇所: `src/components/reader/sidebar-header-view.tsx`, `src/components/reader/article-list-header.tsx`, `src/components/reader/article-toolbar-view.tsx`

## 2026-04-12 画面レビュー追記

- [x] Web プレビューの基本キーボード導線を回帰確認する
  - 問題: `Escape` で閉じる / `B` で外部ブラウザを開く、という期待動作は自然なので、今後の UI 変更でも壊さないようにしておきたい
  - 対象: `src/components/reader/browser-view.tsx`, `src/lib/keyboard-shortcuts.ts`, `src/hooks/use-keyboard.ts`
  - 計画:
    1. Web プレビュー表示中に `Escape` で閉じられることを維持する
    2. `B` で外部ブラウザを開けることを維持し、preview 表示中も違和感なく使えるか確認する
    3. shortcuts settings / cheatsheet / help 導線にも同じ期待動作が見えるようにする

- [x] Web プレビューの chrome / action 導線を記事ツールバーと揃える
  - 問題: Web プレビュー表示中の close / external browser 導線が記事ツールバーと分離しており、操作位置と見た目の一貫性が弱い
  - 対象: `src/components/reader/article-toolbar-view.tsx`, `src/components/reader/browser-view.tsx`, `src/components/shared/icon-toolbar-control.tsx`
  - 計画:
    1. Web プレビューでも記事ツールバーと同じ action 群と並び順を基本にする
    2. 可能なら action strip を shared component に切り出し、article view / browser overlay で共通化する
    3. close のような overlay 固有操作だけを別レイヤーに残す

- [x] reader 本文の focus 表現を中立化する
  - 問題: 記事本文側に出る強い青い focus ring が dark UI の中で浮いて見え、選択状態の強調として過剰
  - 対象: `src/components/ui/scroll-area.tsx`, `src/components/reader/article-view.tsx`
  - 計画:
    1. 現行の青い ring を削除ではなく弱い neutral トーンへ寄せる
    2. keyboard 利用時の focus affordance は残しつつ、通常表示で目立ちすぎない強さに調整する
    3. マウス操作時に常時見えていないかも併せて確認する

- [x] 記事リストで focus と実選択が乖離しないようにする
  - 問題: クリック後の白い囲み線が残ったまま `j/k` で選択が移動し、focus 位置と `selectedArticleId` が別々に見える
  - 対象: `src/components/reader/article-list.tsx`, `src/components/reader/article-list-item.tsx`, `src/components/reader/article-list-screen-view.tsx`
  - 計画:
    1. 行の focus 表示と実際の選択状態を同じ対象へ揃える
    2. クリック由来の白い囲み線を見直し、不要なら削除するか selected 表現に統合する
    3. `j/k` ナビゲーション時の roving focus / listbox 挙動を再設計する

- [x] `h/l` での feed 移動時に sidebar を選択 feed へ追従させる
  - 問題: keyboard で feed を移動しても sidebar が追従せず、現在どの feed を開いているか分かりにくい
  - 対象: `src/components/reader/sidebar.tsx`, `src/components/reader/feed-tree-view.tsx`, `src/stores/ui-store.ts`
  - 計画:
    1. `h/l` による feed selection 変更時は対象 feed の親 folder を自動展開する
    2. 必要なら sidebar scroll も追従させて selected row を可視範囲へ入れる
    3. pointer 選択と keyboard 選択で表示挙動がずれないように整理する

- [x] sidebar でも focus と実選択が乖離しないようにする
  - 問題: feed をクリックしたときの focus ring が残ったまま `h/l` で selection が移動し、sidebar 上でどれが本当に選択中なのか分かりにくい
  - 対象: `src/components/reader/sidebar-nav-button.tsx`, `src/components/reader/feed-tree-row.tsx`, `src/components/reader/sidebar.tsx`
  - 計画:
    1. sidebar row の focus 表示と `selectedFeedId` による選択表示を一致させる
    2. クリック由来の白い囲み線を見直し、不要なら削除するか selected 表現に統合する
    3. pointer / keyboard の両操作で現在地が一目で分かる見た目に揃える

- [x] 起動時のフォルダ展開ポリシーを設定できるようにする
  - 問題: sidebar の folder 展開初期状態は好みが分かれるが、現状は `expandedFolderIds` が起動時に空で固定
  - 対象: `src/stores/preferences-store.ts`, `src/stores/ui-store.ts`, `src/components/settings/general-settings.tsx`, `src/components/reader/sidebar.tsx`
  - 計画:
    1. General > Sidebar に「起動時のフォルダ展開」設定を追加する
    2. 候補は `すべて閉じる` / `未読のあるフォルダを開く` / `前回の状態を復元`
    3. `show_sidebar_unread` など既存 sidebar 表示設定と文言が混ざらない命名にする

- [x] `?` でショートカット一覧を開ける cheatsheet overlay を追加する
  - 問題: ショートカット設定画面は編集用途で、操作中に一覧をすばやく参照する導線がない
  - 対象: `src/lib/keyboard-shortcuts.ts`, `src/hooks/use-keyboard.ts`, `src/components/reader/command-palette.tsx`, `src/components/settings/shortcuts-settings.tsx`
  - 計画:
    1. `show shortcuts help` の action を追加し、既定キーを `?` / `Shift + /` にする
    2. 入力中は無効、`Esc` で閉じる、モーダル内検索ありの cheatsheet overlay を用意する
    3. キー表記は macOS と Windows/Linux で出し分ける
    4. `Ctrl+K` / `⌘K` の command palette からも `Help` / `Shortcuts` を開けるようにする
    5. Tauri では一覧 UI の定義を正本にし、native accelerator / global shortcut は必要最小限だけ派生させる

- [x] 手動同期 action の discoverability を上げる
  - 問題: `sync-all` は action と command palette には存在するが、`reload` 感覚で探すと見つけにくい
  - 対象: `src/components/reader/command-palette.tsx`, `src/lib/actions.ts`, `src/lib/keyboard-shortcuts.ts`
  - 計画:
    1. command palette の手動同期 action に `sync` / `refresh` / `reload` を keywords として持たせる
    2. 今後ショートカットを追加する場合は、shortcuts settings / cheatsheet / command palette で同じ action 名に揃える
    3. `reload webview` と `reload feeds` が混同されないラベルにする

- [x] account detail の rename 導線と情報階層を整理する
  - 問題: アカウント名変更が保存されたか分かりにくく、header subtitle と General > Type が同じ情報を二重表示している
  - 対象: `src/components/settings/account-detail.tsx`, `src/components/settings/account-detail-view.tsx`, `src/components/settings/account-general-section-view.tsx`
  - 計画:
    1. アカウント名の rename を確実に反映し、成功まで editing state を安定維持する
    2. account header ではアカウント名を主役にし、provider 種別は General セクションの 1 箇所に集約する
    3. 変更完了後に title / list / detail の表示がずれないよう query cache 更新を明確にする

- [x] 未読 smart view では未読がない空フォルダを sidebar から隠す
  - 問題: `未読` を選んでも unread feed を持たない folder が sidebar に残り、現在の絞り込み条件と見た目がずれる
  - 対象: `src/components/reader/sidebar.tsx`, `src/__tests__/components/sidebar.test.tsx`
  - 計画:
    1. `viewMode === "unread"` のときだけ、表示 feed が 0 件の folder を sidebar から外す
    2. ただし drag & drop の drop target は壊さないよう、drag 中は空 folder を残す
    3. unread smart view と通常 view の両方をテストで固定する

## 2026-04-12 購読整理 UI copy / 情報設計メモ

- [ ] 購読整理画面に一括操作を追加する
  - 候補: `すべて継続` / `すべて解除候補へ`
  - 現在のスコープでは copy と情報設計を優先し、bulk action は別タスクで検討する
  - 対象候補: `src/components/feed-cleanup/feed-cleanup-page-view.tsx`, `src/components/feed-cleanup/feed-cleanup-page.tsx`

- [ ] 購読整理画面の判断支援に優先度表示を追加する
  - 候補: `高 / 中 / 低` または confidence を示す補助ラベル
  - recommendation copy を補強しつつ、一覧での理解速度をさらに上げたい
  - 対象候補: `src/components/feed-cleanup/feed-cleanup-page-view.tsx`, `src/lib/feed-cleanup.ts`, `src/locales/ja/cleanup.json`, `src/locales/en/cleanup.json`

## 2026-04-13 Refactor フォローアップ

- [x] sidebar の saved account 復元 effect を store action に寄せる
  - 問題: `Sidebar` の初期 account 選択 effect に store setter が集中していて、責務が重く `react-doctor` warning の起点になっている
  - 対象: `src/components/reader/sidebar.tsx`, `src/stores/ui-store.ts`, `src/__tests__/components/sidebar.test.tsx`
  - 計画:
    1. account 復元時の `selectedAccountId` / `selection` / `focusedPane` の更新を 1 つの action にまとめる
    2. `open-web-preview-url` dev intent と mobile 復元時の挙動は維持する
    3. saved account 復元・欠損 account fallback・空 account list の既存テストを守る

- [ ] article list item の pointer / keyboard row semantics を整理する
  - 問題: `article-list-item` の click row が keyboard event を持たず、a11y warning が残っている
  - 対象: `src/components/reader/article-list-item.tsx`, `src/components/reader/article-list.tsx`
  - 計画:
    1. row 自体を button 化するか、現行 DOM のまま keyboard activation を足す
    2. `j/k` ナビゲーションや selected state と衝突しない形にする
    3. article list の既存 keyboard テストがあれば維持し、必要なら追加する

- [ ] oversized reader components を段階分割する
  - 問題: `article-view.tsx` と `sidebar.tsx` はまだ責務が広く、今後の変更コストが高い
  - 対象: `src/components/reader/article-view.tsx`, `src/components/reader/sidebar.tsx`, `src/components/reader/article-list.tsx`
  - 計画:
    1. `article-view` は browser overlay coordination と article actions を段階的に外へ出す
    2. `sidebar` は account restore / startup expansion / hidden-state fallback を hook 化する
    3. 1 回で大きく割らず、warning を 1 つずつ消す単位で進める
