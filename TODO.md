# Ultra RSS Reader — TODO

完了済みの UI review / overlay / settings / sidebar 改善項目は `CHANGELOG.md` の `[Unreleased]` に移動済み。

## UI/UX 監査の残り

- [ ] モバイル向け UI を正式対応する段階で、アイコンのみ導線の見直しを再開する
  - 現時点では mobile を主要提供面にしないため必須対応から外すが、狭い幅での discoverability 課題として保留する
  - 対応する場合は tooltip 前提の主要操作を、ラベル表示かメニュー集約で補う
  - 候補箇所: `src/components/reader/sidebar-header-view.tsx`, `src/components/reader/article-list-header.tsx`, `src/components/reader/article-toolbar-view.tsx`

## 2026-04-12 購読整理 UI copy / 情報設計メモ

- [x] 購読整理画面に一括操作を追加する
  - 実装: `表示中をまとめて継続` / `表示中をまとめて保留`
  - 現在の filter と deferred 表示条件で見えている候補だけに作用する
  - 対象候補: `src/components/feed-cleanup/feed-cleanup-page-view.tsx`, `src/components/feed-cleanup/feed-cleanup-page.tsx`

- [x] 購読整理画面の判断支援に優先度表示を追加する
  - 実装: `高優先 / 中優先 / 低優先` 相当の補助ラベルを queue / review に追加
  - recommendation copy は既存の `tone / titleKey / summaryKey` を維持したまま補強する
  - 対象候補: `src/components/feed-cleanup/feed-cleanup-page-view.tsx`, `src/lib/feed-cleanup.ts`, `src/locales/ja/cleanup.json`, `src/locales/en/cleanup.json`

## 2026-04-13 Refactor フォローアップ

- [x] settings 系の共通 row / heading を `src/components/shared` へ寄せる
  - 問題: `settings-components.tsx` / `settings-page-view.tsx` / `account-sync-section-view.tsx` などに同系統の labeled control row 実装が散っている
  - 対象: `src/components/shared/*`, `src/components/settings/*`
  - 計画:
    1. 汎用な heading / select row / switch row を `shared` へ切り出す
    2. settings 周辺の重複実装を順次置き換える
    3. 既存の accessibility と selected label 表示をテストで維持する

- [ ] oversized reader components を段階分割する
  - 問題: `article-view.tsx` と `sidebar.tsx` はまだ責務が広く、今後の変更コストが高い
  - 対象: `src/components/reader/article-view.tsx`, `src/components/reader/sidebar.tsx`, `src/components/reader/article-list.tsx`
  - 計画:
    1. `article-view` は browser overlay coordination と article actions を段階的に外へ出す
    2. `sidebar` は account restore / startup expansion / hidden-state fallback を hook 化する
    3. 1 回で大きく割らず、warning を 1 つずつ消す単位で進める

- [x] browser/list で意味を持つマジックナンバーを constants に寄せる
  - 対象: `src/components/reader/article-list.tsx`, `src/constants/browser.ts`, `src/constants/reader.ts`, `src/lib/browser-debug-geometry.ts`, `src/lib/browser-webview.ts`
  - 方針: 検索 debounce 時間、browser scale factor fallback、geometry 表示精度を定数名で管理する

- [x] settings 系の散在型を `types` として整理する
  - 問題: view component 内に export された props / control 型が点在し、import 境界と責務の境界が一致していない
  - 対象候補: `src/components/settings/settings-page-view.tsx`, `src/components/settings/account-*-view.tsx`, `src/components/settings/add-account-form-view.tsx`
  - 今回の方針:
    1. 複数ファイルから参照される型だけを切り出す
    2. component 内部だけで閉じる private な型は無理に外へ出さない
    3. 振る舞い変更なしを前提に、import 経路だけを整理する
  - 実施:
    1. `settings-page.types.ts` を新設して settings page 系の props / control 型を集約
    2. `account-detail.types.ts` を新設して account detail 系 section props を集約
    3. 既存 view component は描画責務に寄せ、型 export を剥がした
