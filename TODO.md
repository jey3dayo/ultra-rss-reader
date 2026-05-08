# Ultra RSS Reader — TODO

完了済みの項目は `CHANGELOG.md` を参照し、このファイルには未完了タスクだけを残す。

## 開発データ運用

- [ ] デバッグ画面から本番相当データを Dev 環境へ安全に同期する導線を検討する
  - 本番アプリでは表示せず、Dev 起動時だけ利用できるようにする
  - SQLite 接続中の DB を直接置き換えないよう、Dev 側 DB のバックアップ、アプリ終了、コピー、再起動まで含めた安全なフローにする
  - Windows と macOS の app data パス差、`ultra-rss-reader.db` / `-wal` / `-shm` の扱い、OS Keyring と Dev file credentials の差を考慮する
  - まずは `mise run app:dev:seed-from-prod` のような手動コマンドで安全性を固めてから、デバッグ画面ボタンへ接続する

## UI/UX 監査の残り

- [ ] Browser overlay 周辺への共通 motion 適用を検証する
  - Tauri child webview geometry と重なり、見た目の polish よりレイアウト安定性を優先する必要がある
  - 適用する場合は `browser-overlay-stage` / `browser-overlay-chrome` / native webview bounds の同期を実機で確認してから進める
  - `transitions-dev` の page side-by-side / panel reveal 相当を入れる場合は、WebView bounds 更新と CSS transform が二重に効かないかを先に確認する
  - まずは既存 overlay の resize / open / close 時に jank が出ているかを計測し、必要な箇所だけに限定する

- [ ] 高頻度・高密度 UI への motion 適用は専用検証バッチで進める
  - Article detail の記事切替は本文読書中の視線移動に影響するため、title / meta / tag area ごとに必要性を見て限定適用する
  - Feed tree drag overlay はドラッグ中の高頻度更新と重なるため、入口だけにするか、drag preview には適用しない方針も含めて実機確認する
  - `article-list-item` の row hover / selected transition は連続キー移動で毎フレーム効くため、`motion-static-hover-surface` への置換は計測後に行う
  - どちらも適用前後でキーボード操作、ドラッグ、連続記事移動時の jank を確認する

- [x] Text / number swap の追加適用候補を実データ更新頻度で分ける
  - 現状: 件数バッジなどの短い数値は `MotionNumber` に寄せ、`UI Reference/View Specimens Canvas` に基準面を置く。追加適用は同期カウント・検索結果数のような短い表示に限定する
  - 記事本文、長いタイトル、フィード名には適用しない。読む対象そのものが動いて見えると視線移動が増える

- [x] `Debug HUD` の collision handling を見直す
  - dev アプリ実機で、HUD を表示したまま `設定` モーダルを開くと HUD がモーダル上に残り、内容を隠しうる
  - 2026-04-28 の実機レビューで、設定モーダル右下の操作領域と HUD が重なり、閉じるボタン周辺の可読性と操作性を下げることを再確認
  - 現状: HUD は `Move debug HUD` で 4 隅を巡回でき、閉じる操作は設定の `Debug HUD` と同じ preference を `false` にする
  - 少なくとも modal / dialog / toast などの高優先 overlay と重なったときは、自動で退避・縮小・片側ドック・一時非表示のいずれかが必要
  - 対象: `src/components/debug/focus-debug-hud-view.tsx`, `src/components/app-shell.tsx`

- [ ] モバイル向け UI を正式対応する段階で、アイコンのみ導線の見直しを再開する
  - 現時点では mobile を主要提供面にしないため必須対応から外すが、狭い幅での discoverability 課題として保留する
  - 対応する場合は tooltip 前提の主要操作を、ラベル表示かメニュー集約で補う
  - 候補箇所: `src/components/reader/sidebar-header-view.tsx`, `src/components/reader/article-list-header.tsx`, `src/components/reader/article-toolbar-view.tsx`

## 次の並列バッチ候補

- 次に大きな UI バッチを始めるときは、必要な write scope ごとにここへ再追加する

- [ ] 参照範囲が広い settings 配置候補を別バッチで見直す
  - `settings-nav.types.ts` は settings rail contract として `SettingsNavView` / `AccountsNavView` / Storybook specimen / view tests にまたがるため、settings nav 境界が増えた時に再評価する
  - `settings-page.types.ts` は public page/control contract に絞る。control union が肥大化した時は page/control contract 自体の分割を検討する
  - `settings-modal.types.ts` は modal view contract に絞る。新しい settings surface が増えて content routing props が再び肥大化した時に分離する

- [ ] 参照範囲が広い root-level type を別バッチで分割する
  - reader selection は `src/lib/reader/reader-selection.types.ts` を source of truth にする。新しい `UiSelection` alias は増やさない
  - さらに state type を分割する場合は、`src/stores/ui-store.ts` 自体を slice 化できる段階で実施する。store action / selector / dev scenario への参照が広いため別バッチにする

- [ ] 参照範囲が広い reader type surface を別バッチで分割する
  - `article-list.types.ts` は list view / header / footer / hooks にまたがるため、article-list controller 境界を見直す時に分割する
  - `add-feed-dialog.types.ts` / `rename-feed-dialog.types.ts` は dialog state / controller hooks / shared form parts にまたがるため、feed dialog flow の責務分割時に再評価する
  - `sidebar.types.ts` は sidebar view / section props / smart views / content props にまたがるため、sidebar controller と view contract の分割単位を先に決める
  - `browser-view.types.ts` は browser overlay / webview sync / diagnostics hooks / tests にまたがるため、native webview 境界の変更と同じバッチで扱う
  - `command-palette.types.ts` は palette data / runtime / action groups / result rendering にまたがるため、command palette hooks の責務分割時に再評価する

- [ ] 小粒 cleanup 候補を別バッチで見直す
  - UI class variant の追加テストは shared component の semantic token / role contract に限定する。hover 全量や visual snapshot は固定しない
  - pure helper の追加テストは、境界値・source selection・query plan など挙動の契約として価値があるものだけ残す
  - view-level props の `export type` は hook / Storybook / tests の contract として使うものだけ残す。外部 import がない helper props は触るファイルごとに local type へ戻す
  - reader の残りは sidebar / article-list / browser geometry / command palette / feed dialog flow など参照範囲が広い単位で見直す
  - `src/components/ui/` の primitive wrapper props は shadcn/Base UI wrapper API として扱う。外部 import がなくても、公開 wrapper contract の方針を決めるまでは一括 local 化しない
  - shared component の `.types.ts` は、複数ファイルで共有する contract だけ残す。`dialog.types.ts` の `ConfirmDialogVariant` のように store / view にまたがるものは、呼び出し境界が変わる時に見直す
  - Browser geometry の数値固定や picker 専用 chip variant の網羅は参照範囲が広く、実機/呼び出し側 layout 影響を見てから別バッチで扱う

- [ ] reader article-list 分割候補を別バッチで見直す
  - `article-list.types.ts` の header / header actions / feed mode control / footer / item props は、各 view file へ colocate できるか確認する
  - `UseArticleList*Params` / `UseArticleList*Result` は controller / hook contract として残し、view props local 化とは同じコミットに混ぜない
  - article list は keyboard navigation / selection / scroll / grouping にまたがるため、header 系・body/item 系・controller hook 系の順で worker scope を分ける

- [ ] reader sidebar 分割候補を別バッチで見直す
  - `sidebar.types.ts` の header / nav button / footer actions / smart views / account section / content view props は、component ごとに colocate できるか確認する
  - `SidebarControllerResult` / `SidebarSectionPropsResult` / hook params は controller contract として扱い、view props の移動と分ける
  - `SidebarTagListProps` / `SidebarFeedTreeProps` は feed tree / tag section / sidebar hooks にまたがるため、先に参照単位を決めてから移動する

- [ ] browser hook type surface 分割候補を別バッチで見直す
  - `browser-view.types.ts` の runtime / event bridge / webview sync / diagnostics / focus return hook params/results を、hook 群ごとの type file へ分けられるか確認する
  - geometry / presentation / diagnostics payload は browser overlay と native webview 境界の共有 contract として残す
  - WebView bounds、layout 数値、overlay resize 挙動は型整理と混ぜず、実機検証バッチで扱う

- [ ] feed dialog controller contract 整理候補を別バッチで見直す
  - add / rename feed dialog の controller folder select props、submit params、derived params を hook / controller 単位で整理できるか確認する
  - view props は local 化済みのため、次は `use-add-feed-dialog-*` / `use-rename-feed-dialog-*` の入出力 contract に限定する
  - `FolderSelectViewProps` は add / rename dialog の共有境界なので、移動する場合は folder select contract の単独バッチにする

- [ ] settings account-detail contract 整理候補を別バッチで見直す
  - `account-detail/types.ts` の section view props と hook/controller params/results を、view / hook / controller の責務単位に分けられるか確認する
  - account detail views / hooks / tests / account config form にまたがるため、settings 全体の配置変更とは混ぜない
  - sync status rows / danger zone / credentials editor は挙動テストの境界が違うため、必要なら worker scope を分ける

- [ ] pure helper test 候補を別バッチで追加する
  - article list selection / navigation scroll / grouping / mark-all-read count は、境界値と source selection の契約テストを追加する価値がある
  - sidebar smart views / feed tree visibility / subscription review candidates は、入力セットが小さい pure helper から優先する
  - UI snapshot、hover class 全量、motion class の見た目固定は避け、失敗時に仕様差分が分かる assertion に限定する

- [ ] motion / browser 実機検証候補を別バッチで整理する
  - Browser overlay motion は WebView bounds 同期と重なるため、open / close / resize / diagnostics toggle の実機計測を先に行う
  - Article transition は title / meta / tag area / body のどこへ適用するかを、連続記事移動と読書中の視線移動で確認する
  - Feed tree drag overlay は pointer move 中の高頻度更新と重なるため、drag preview 自体へ motion を入れない選択肢も含めて検証する
