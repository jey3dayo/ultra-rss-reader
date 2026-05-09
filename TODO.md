# Ultra RSS Reader — TODO

完了済みの項目は `CHANGELOG.md` を参照し、このファイルには未完了タスクだけを残す。

## 開発データ運用

- [ ] P1 デバッグ画面から本番相当データを Dev 環境へ安全に同期する導線を検討する
  - 本番アプリでは表示せず、Dev 起動時だけ利用できるようにする
  - 既存の `mise run app:dev:seed-from-prod` を前提に、デバッグ画面から誤操作なく呼べる UX と確認導線を設計する
  - Dev 側 DB のバックアップ場所、アプリ再起動、credentials はコピーされないことを UI 上で明示する

## UI/UX 監査の残り

- [ ] P3 Browser overlay 周辺への共通 motion 適用を検証する
  - Tauri child webview geometry と重なり、見た目の polish よりレイアウト安定性を優先する必要がある
  - 適用する場合は `browser-overlay-stage` / `browser-overlay-chrome` / native webview bounds の同期を実機で確認してから進める
  - `transitions-dev` の page side-by-side / panel reveal 相当を入れる場合は、WebView bounds 更新と CSS transform が二重に効かないかを先に確認する
  - まずは既存 overlay の resize / open / close 時に jank が出ているかを計測し、必要な箇所だけに限定する

- [ ] P3 高頻度・高密度 UI への motion 適用は専用検証バッチで進める
  - Article detail の記事切替は本文読書中の視線移動に影響するため、title / meta / tag area ごとに必要性を見て限定適用する
  - Feed tree drag overlay はドラッグ中の高頻度更新と重なるため、入口だけにするか、drag preview には適用しない方針も含めて実機確認する
  - `article-list-item` の row hover / selected transition は連続キー移動で毎フレーム効くため、`motion-static-hover-surface` への置換は計測後に行う
  - どちらも適用前後でキーボード操作、ドラッグ、連続記事移動時の jank を確認する

- [ ] P3 モバイル向け UI を正式対応する段階で、アイコンのみ導線の見直しを再開する
  - 現時点では mobile を主要提供面にしないため必須対応から外すが、狭い幅での discoverability 課題として保留する
  - 対応する場合は tooltip 前提の主要操作を、ラベル表示かメニュー集約で補う
  - 候補箇所: `src/components/reader/sidebar-header-view.tsx`, `src/components/reader/article-list-header.tsx`, `src/components/reader/article-toolbar-view.tsx`

## 問題化リスク追加候補

- [ ] P2 reader focus DOM selector drift を検出する
  - 対象: `src/lib/reader-focus.ts`, reader list/sidebar/account pane components
  - focus helper が data attribute selector に強く依存しており、view refactor で attribute が外れると keyboard navigation が silent fallback になりやすい
  - selector source of truth または repo contract test を追加し、主要 focus target attribute の存在を固定する

- [ ] P2 article list retained snapshot duplicate identity contract を固定する
  - 対象: `src/lib/articles/article-list.ts`, `src/components/reader/hooks/article-list/use-article-list-data.ts`
  - retained article snapshot は Map で id 重複を後勝ち merge するため、same id with stale read/star state が source 間で競合した時の表示が未固定
  - retained snapshot stale、current source duplicate、search/tag/source切替の merge order を pure helper test にする

- [ ] P2 Rust app startup filesystem failure diagnostics を補強する
  - 対象: `src-tauri/src/lib.rs`, `src-tauri/build.rs`
  - app data dir 作成 / DB init / log cleanup で `expect` / `panic` / silent remove failure が混在しており、packaged startup failure の user-facing message が揺れやすい
  - app data permission denied、DB open failure、log cleanup permission denied の message と recovery guidance を native test / manual verification に分ける

- [ ] P1 child webview command invoke 権限を検証する
  - 対象: `src-tauri/capabilities/default.json`, `src-tauri/src/browser_webview.rs`, `src-tauri/src/commands/browser_webview_commands.rs`
  - embedded webview bridge が native command を invoke する経路は capability / window label / webview label の前提が壊れると packaged app だけで失敗しやすい
  - main webview と child webview の permission 差を整理し、close bridge / back-forward mouse bridge の invoke 可否を manual verification に残す

- [ ] P2 browser diagnostics preference 即時反映 contract を固定する
  - 対象: `src-tauri/src/lib.rs`, `src-tauri/src/browser_webview.rs`, `src-tauri/src/commands/preference_commands.rs`
  - native browser diagnostics flag が startup preference だけを読む場合、settings で Debug HUD を切り替えても native emit が即時追従しない可能性がある
  - preference update event / app restart required / frontend-only HUD のどれを正にするか決め、debug diagnostics の manual verification に残す

- [ ] P1 Tauri unstable feature を release build で許可する条件を棚卸しする
  - 対象: `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/src/browser_webview.rs`
  - `tauri` に `unstable` feature が入っているため、release artifact で使ってよい API 面積と将来の breaking risk が明文化されていない
  - unstable API の使用箇所、必要理由、代替可能性、release smoke で見るべき挙動を一覧化し、不要なら feature を外す

- [ ] P1 article thumbnail URL の sanitizer/privacy 境界を固定する
  - 対象: `src-tauri/src/infra/provider/normalizer.rs`, `src/api/schemas/article.ts`, `src/components/reader/article-list-item.tsx`, `src/components/reader/article-content-view.tsx`
  - `content_sanitized` は Rust sanitizer 境界がある一方、`thumbnail` は provider 由来 URL を `<img src>` に渡すため、remote image privacy と scheme policy が本文 HTML と別管理になりやすい
  - http/https/relative/data/private URL policy を決め、normalizer / ArticleDtoSchema / reader rendering の contract test を追加する

- [ ] P2 Tauri CSP の external img/frame 許可面積を feed content / browser webview 境界で整理する
  - 対象: `src-tauri/tauri.conf.json`, `docs/feed-content-privacy.md`, `src/components/reader/article-content-view.tsx`
  - CSP で `img-src` / `frame-src` が `http:` / `https:` を広く許可している場合、feed content と browser webview の責務境界が security config 上で見えにくい
  - reader thumbnail、sanitized article body、Web Preview、child webview の許可面積を threat model と manual verification に分ける

- [ ] P3 feed content privacy hardening の実測タスクを docs checklist と接続する
  - 対象: `docs/feed-content-privacy.md`, `TODO.md`
  - privacy hardening の大枠 TODO だけだと、reader thumbnail、sanitized body remote media、Web Preview の実測観点が混ざりやすい
  - `docs/feed-content-privacy.md` の checklist と TODO の実行単位を対応させ、manual verification を reader thumbnail / sanitized body / Web Preview に分割する

## 次の並列バッチ候補

- 次に大きな UI バッチを始めるときは、必要な write scope ごとにここへ再追加する
