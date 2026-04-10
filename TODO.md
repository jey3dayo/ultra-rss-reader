# Ultra RSS Reader — TODO

## 2026-04-10 画面巡回レビュー

- [ ] Webプレビュー表示中の重複アクション露出を整理する
  - 問題: オーバーレイ表示中でも背面ツールバー側の `Webプレビューを閉じる` / `外部ブラウザで開く` が同時に露出し、スクリーンリーダー・音声操作・自動操作で対象が曖昧になる
  - 対象: `src/components/reader/article-view.tsx`, `src/components/reader/article-toolbar-view.tsx`, `src/components/reader/browser-view.tsx`
  - 計画:
    1. overlay 表示中は背面ツールバーの該当操作を `inert` / `aria-hidden` / 非表示のいずれかで単一導線に寄せる
    2. overlay 側のラベルも文脈付きにするか、少なくとも重複ラベルを減らす
    3. browser-mode と Tauri 実機の両方で開閉・フォーカス復帰を再確認する

- [ ] Feed Cleanup の 3 カラム密度をラップトップ幅基準で調整する
  - 問題: `240px / 可変 / 340px` の固定配分が 1280px 前後だと窮屈で、確認ペインの説明とアクションが圧縮される
  - 対象: `src/components/feed-cleanup/feed-cleanup-page-view.tsx`
  - 計画:
    1. `lg` 1 本の切り替えではなく、中間幅用の 2 カラム or 可変カラム幅を追加する
    2. 右ペインの要約カードとアクション群を sticky / collapse などで再配置する
    3. `open-feed-cleanup` と `open-feed-cleanup-broken-references` の両シナリオで見え方を比較する

- [ ] 記事詳細のタグ追加導線を見つけやすくする
  - 問題: 記事本文上部の `+` ボタンが孤立して見え、タグ機能の存在と役割に気づきにくい
  - 対象: `src/components/reader/article-view.tsx`, `src/components/reader/article-tag-picker-view.tsx`
  - 計画:
    1. 空状態でも「タグ」見出しか補助文を残して操作意図を明示する
    2. ボタン単体ではなく chip row / inline action として視覚的なまとまりを作る
    3. キーボードフォーカス時と hover 時の誘導も合わせて見直す

- [ ] Settings モーダルの低いビューポートでの情報密度を見直す
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
