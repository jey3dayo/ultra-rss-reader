# Ultra RSS Reader — TODO

次回リリース候補は `minor` を想定しており、2026-04-14 時点の committed な進捗は `CHANGELOG.md` の `[Unreleased]` へ反映済み。

## UI/UX 監査の残り

- [ ] モバイル向け UI を正式対応する段階で、アイコンのみ導線の見直しを再開する
  - 現時点では mobile を主要提供面にしないため必須対応から外すが、狭い幅での discoverability 課題として保留する
  - 対応する場合は tooltip 前提の主要操作を、ラベル表示かメニュー集約で補う
  - 候補箇所: `src/components/reader/sidebar-header-view.tsx`, `src/components/reader/article-list-header.tsx`, `src/components/reader/article-toolbar-view.tsx`
- [ ] `DESIGN.md` を参照し、主要コンポーネントのリデザイン方針を整理して段階的に適用する
  - warm cream 系の配色、太すぎないタイポグラフィ、境界線と余白のルールを既存 UI に馴染む形で再設計する
  - まずは reader 周辺の主要コンポーネントを対象に、影響の大きいものから優先して見直す
  - 実装時は既存の操作性と可読性を崩さず、単なる見た目変更ではなく情報階層も合わせて調整する
- [ ] `DESIGN.md` 準拠の色管理レイヤーを維持しつつ、直書き色の整理方針を段階的に適用する
  - 現在の準拠済みレイヤー:
    - `src/styles/global.css` の `:root` / `:root.dark` にあるセマンティックトークン群（`--background`, `--foreground`, `--primary`, `--surface-*`, `--shadow-elevation-*`）
    - 同ファイル先頭の `@theme inline` による Tailwind セマンティッククラスへのマッピング（`bg-background`, `text-foreground`, `border-border`, `bg-surface-*`, `shadow-elevation-*`）
    - 既存 UI で広く使っている `bg-background`, `bg-card`, `text-muted-foreground`, `border-border`, `bg-sidebar` などのトークン参照クラス
    - 旧 UI 向けの `--bg-*`, `--text-*`, `--border-*` も中央定義ではあるので、当面はこの層に寄せて一元管理を維持する
  - コード修正で準拠させる項目:
    - [ ] browser overlay 系の白黒アルファ直書きをセマンティックトークンへ寄せる
      - 対象: `src/components/reader/browser-view.tsx`, `src/components/reader/browser-overlay-presentation.ts`, `src/components/reader/browser-overlay-chrome.tsx`, `src/components/reader/browser-overlay-stage.tsx`, `src/components/reader/browser-surface-state-card.tsx`, `src/components/reader/article-empty-state-view.tsx`
      - `border-white/*`, `bg-black/*`, `bg-white/*`, `text-white/*`, `shadow-[rgba(...)]` が多く、`DESIGN.md` の warm cream / warm border 系と分離している
    - [ ] dialog / picker 系の arbitrary rgba をトークンへ寄せる
      - 対象: `src/components/ui/dialog.tsx`, `src/components/settings/service-picker.tsx`
      - overlay や hover/focus の `bg-[rgba(...)]`, `hover:border-[rgba(...)]`, `focus-visible:shadow-[rgba(...)]` を `DESIGN.md` 準拠の scrim / border / elevation に揃えたい
  - `DESIGN.md` 追記とトークン追加で吸収する項目:
    - [ ] warning / info / state 表現で残っている Tailwind の青・黄・アンバー直書きを、意味ベースの state token に置き換える
      - 対象: `src/components/shared/article-state-icon.tsx`, `src/components/reader/article-list-context-strip.tsx`, `src/components/reader/article-list-item.tsx`, `src/components/reader/article-pane-view.tsx`, `src/components/feed-cleanup/feed-cleanup-queue-panel.tsx`, `src/components/feed-cleanup/feed-cleanup-review-panel.tsx`, `src/components/feed-cleanup/feed-cleanup-overview-panel.tsx`, `src/components/feed-cleanup/feed-cleanup-page-view.tsx`, `src/components/shared/feed-detail-panel.tsx`, `src/components/subscriptions-index/subscriptions-overview-summary.tsx`
      - `warning`, `info`, `favorite`, `unread` などの用途別トークンを `DESIGN.md` と token layer に追加してから置き換える
  - 例外パレットとして中央管理する項目:
    - [ ] タグ色パレットを UI ごとの重複定義から共通定数へ寄せる
      - 対象: `src/components/settings/tags-settings.tsx`, `src/components/reader/tag-context-menu.tsx`, `src-tauri/migrations/V13__tag_color_palette_refresh.sql`
      - タグ色はテーマ色ではなくデータパレットとして一箇所で管理する
    - [ ] サービス別ブランド色の直書きは provider brand token として中央管理する
      - 対象: `src/components/settings/add-account-services.ts`
      - `#0062BE`, `#1875F3` などは theme token へ吸収せず、ブランド例外色として切り出す

## Deferred Follow-ups

- [ ] DB migration recovery の追加 hardening は migration 変更時に issue #23 を参照する
  - 常設 TODO ではなく、次に migration を触るタイミングでまとめて扱う
  - 失敗系テストや復旧手順の補強は issue #23 に集約する
- [ ] ミュート時に自動既読にする設定を、他の実装が落ち着いた後に再開する
  - 現状のミュートは一覧・タグ一覧・検索結果から非表示にするだけで、既読状態は変更しない
  - 着手時は未読数、バッジ、`すべて既読` との整合もまとめて見直す
  - UI 上は `Settings > ミュート` に工事中として位置だけ確保済み

## Recently Closed

- Storybook の i18n fallback crash、favicon 404 noise、固定幅 wrapper による mobile overflow を解消した
- browser-mode の account sync status mock、settings modal、reader narrow layout、feed cleanup responsive layout を調整した
- Feed Cleanup の bulk action / priority cue 追加と、settings / shared / reader の contract refactor batch を完了した
- release manual verification、incident runbook、feed content privacy/CSP 方針を docs に整理した
- focus debug HUD の右寄せ・shell 統一・overlay strip 除去、browser surface fallback card の横幅調整、settings の web preview launch action の inline 化を進めた
- settings page の preference view props input を shared types に寄せ、account detail の cache/error toast と reader の feed query cache を small helper として共通化した
