# Ultra RSS Reader — TODO

次回リリース候補は `minor` を想定しており、2026-04-14 時点の committed な進捗は `CHANGELOG.md` の `[Unreleased]` へ反映済み。

## UI/UX 監査の残り

- [ ] モバイル向け UI を正式対応する段階で、アイコンのみ導線の見直しを再開する
  - 現時点では mobile を主要提供面にしないため必須対応から外すが、狭い幅での discoverability 課題として保留する
  - 対応する場合は tooltip 前提の主要操作を、ラベル表示かメニュー集約で補う
  - 候補箇所: `src/components/reader/sidebar-header-view.tsx`, `src/components/reader/article-list-header.tsx`, `src/components/reader/article-toolbar-view.tsx`

## Deferred Follow-ups

- [ ] DB migration recovery の追加 hardening は migration 変更時に issue #23 を参照する
  - 常設 TODO ではなく、次に migration を触るタイミングでまとめて扱う
  - 失敗系テストや復旧手順の補強は issue #23 に集約する

## Recently Closed

- Storybook の i18n fallback crash、favicon 404 noise、固定幅 wrapper による mobile overflow を解消した
- browser-mode の account sync status mock、settings modal、reader narrow layout、feed cleanup responsive layout を調整した
- Feed Cleanup の bulk action / priority cue 追加と、settings / shared / reader の contract refactor batch を完了した
- release manual verification、incident runbook、feed content privacy/CSP 方針を docs に整理した
- focus debug HUD の右寄せ・shell 統一・overlay strip 除去、browser surface fallback card の横幅調整、settings の web preview launch action の inline 化を進めた
- settings page の preference view props input を shared types に寄せ、account detail の cache/error toast と reader の feed query cache を small helper として共通化した
