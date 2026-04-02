# Ultra RSS Reader — TODO

## 自動ワイドスクリーンの仕上げ

- [ ] 自動ワイドスクリーン overlay の最終 polish を仕上げる
  - `×` の hover / active / focus-visible を最終確認し、必要なら 1 段だけ詰める
  - lane の余白が「close のための逃がし」に見えないか、Tauri 実画面で最終確認する
  - scrim と stage の境界コントラストを環境差込みで見直し、必要なら半段だけ調整する
- [ ] overlay の振る舞いを最終判断する
  - scrim クリックで閉じるかどうかを仕様として確定する
  - focus trap を入れるか、現状の focus restore で十分かを判断する
  - 開閉アニメーションを入れるなら、ごく軽い easing のみに留める
- [ ] Tauri の実機スクショをループで取りながら、overlay の最終見た目を確定する
  - `×` の位置、scrim の濃さ、枠なしの見え方を main 基準で確認する
  - native WebView の bounds と DOM 上の見た目がずれて見えないかを都度確認する
  - resize / DPI 変更時に再配置が崩れないかを軽く確認する
- [x] 実機確認用の debug intent を、ノイズの少ない専用導線として作り直す
  - `app:dev:image-viewer` で overlay 直行と mock page 表示まで確認済み
  - 実 provider での最終確認は、overlay UI の見た目が固まってから別途詰める

## UI ブラウザ散策メモ

- [ ] UI/UX 監査で見つかった改善を小さいものから順に解消する
  - [x] 設定画面の日本語 UI に残っている英語混在ラベルを自然な日本語に直す
    - `Unread を表示` / `Starred を表示` / `Tags を表示`
    - 候補箇所: `src/locales/ja/settings.json`
  - [x] UI 文言の `...` を `…` に寄せて表記を統一する
    - loading / adding / placeholder / `〜...` 系のラベルを優先
    - 候補箇所: `src/locales/ja/*.json`, `src/locales/en/*.json`
  - [x] ダークテーマで `color-scheme: dark` を明示し、ネイティブ UI の見え方を安定させる
    - 候補箇所: `src/styles/global.css`
  - [ ] モバイル幅で 32px 前後に留まっている主要アイコンボタンのタップ領域を 44px 基準へ近づける
    - 対象候補: 同期 / 追加 / サイドバー表示 / 検索 / 既読化 / 記事ツールバー / 設定の閉じる
    - 候補箇所: `src/components/ui/button.tsx`, `src/components/ui/switch.tsx`, `src/components/shared/icon-toolbar-control.tsx`
  - [ ] モバイルでアイコンのみの操作に依存している導線を見直す
    - tooltip 前提になっている主要操作を、ラベル表示かメニュー集約で補う
    - 候補箇所: `src/components/reader/sidebar-header-view.tsx`, `src/components/reader/article-list-header.tsx`, `src/components/reader/article-toolbar-view.tsx`
  - [x] `transition-all` を必要なプロパティだけに絞って、動きの意図を明確にする
    - 候補箇所: `src/components/ui/button.tsx`, `src/components/app-shell.tsx`

- [x] Windows として動作するブラウザ mock でも、設定画面の文言に `⌘` 表記が残っている
  - 再現: ブラウザモード (`http://127.0.0.1:4173/`) で設定を開き、`一般 > 記事一覧` のトグル文言を見る
  - 現状は `⌘クリックでアプリ内ブラウザを開く` と表示されるが、Windows では `Ctrl` 系の表記に寄せたい
  - 候補箇所: `src/locales/ja/settings.json`, `src/locales/en/settings.json`
- [x] ブラウザモード用 mock の未読件数が記事データと一致しておらず、1件既読にしただけで件数が大きく跳ぶ
  - 再現: ブラウザモードで任意の記事を1件開くと、サイドバーの未読件数がそのフィード全件ぶん減ったように見える
  - `mockFeeds[].unread_count` の初期値と `mockArticles` の実件数がずれており、`recalcUnread()` 実行後に表示が急変する
  - 候補箇所: `src/dev-mock-data.ts`, `src/dev-mocks.ts`
- [x] 記事詳細ヘッダーの日付だけが UI 言語に関係なく英語固定で表示される
  - 再現: ブラウザモード (`http://127.0.0.1:4173/`) で任意の記事を開く
  - 現状はサイドバーや設定が日本語でも、右ペイン上部が `TUESDAY, MARCH 31, 2026 AT 11:30 AM` のような英語表記になる
  - 候補箇所: `src/lib/article-view.ts`, `src/__tests__/lib/article-view.test.ts`
- [x] ブラウザ mock で `ブラウザで表示` を押すと `読込中` のまま完了せず、browser mode の動作確認が止まる
  - 再現: ブラウザモードで記事を開き、ツールバーの `ブラウザで表示` を押す
  - 3 秒以上待っても URL バー横が `読込中` のままで、mock 上は dedicated browser window の完了状態へ遷移しない
  - `create_or_update_browser_webview` の mock 応答が `is_loading: true` 固定で、状態更新イベントも飛ばない
  - 候補箇所: `src/dev-mocks.ts`, `src/components/reader/browser-view.tsx`
- [x] 幅 375px 前後まで狭めると、アプリ本体が左へ押し出されて画面上ではほぼ真っ黒に見える
  - 再現: Playwright で viewport を `375x900` にして `http://127.0.0.1:4173/` を開く
  - DOM 上は要素が存在するが、主要要素の `x` 座標が `-1125px` 付近までずれており表示領域に入ってこない
  - 768px では表示されるため、mobile layout への切替時の translate 計算か初期 focus pane の組み合わせを疑いたい
  - 候補箇所: `src/components/app-layout.tsx`, `src/hooks/use-layout.ts`, `src/stores/ui-store.ts`
- [x] 幅 375px の初期表示でサイドバーと設定導線が画面外に退避し、フィード一覧から戻れない
  - 再現: Playwright で viewport を `375x900` にして `http://127.0.0.1:4173/` または `http://127.0.0.1:4174/` を開く
  - 初期表示では記事一覧だけが `x=0` に出る一方、`FreshRSS` は `x=-359px`、`設定` は `x=-221px`、同期/追加ボタンも `x<0` になり操作できない
  - 記事を開いてから `表示を閉じる` を押してもサイドバーは画面内へ戻らず、mobile 幅で feed/account/settings に遷移できない
  - 候補箇所: `src/components/app-layout.tsx`, `src/hooks/use-layout.ts`, `src/stores/ui-store.ts`
- [x] 記事検索の入力欄が placeholder 依存で、スクリーンリーダー向けのラベルを持っていない
  - 再現: ブラウザモード (`http://127.0.0.1:4173/`) でツールバーの `記事を検索` を押す
  - Playwright で開いた input を確認すると `name=\"article-search\"` はあるが `label` / `aria-label` / `aria-labelledby` が付いておらず、placeholder の `記事を検索...` だけではアクセシブルネームにならない
  - Web Interface Guidelines 的にも form control は label か `aria-label` が必要で、placeholder の三点リーダーも `...` ではなく `…` に寄せたい
  - 候補箇所: `src/components/reader/article-list-header.tsx`, `src/locales/ja/reader.json`, `src/locales/en/reader.json`

- [x] `未読` フィルタ中に `すべて既読にする` を実行しても、記事一覧がその場では空にならず read 済み記事が残る
  - 再現: ブラウザモード (`http://127.0.0.1:4173/`) を開いた直後の `未読` フィルタで、ツールバーの `すべて既読にする` を押して確認ダイアログを確定する
  - サイドバーの未読件数は `0` になるが、中央の一覧にはさっきまでの unread 記事がそのまま薄く残り、フィルタ条件と表示が食い違う
  - Playwright では `containsFirstHeadlineAfterMarkAll = true` を確認済みで、一覧を見たまま誤操作しやすい
  - `recentlyReadIds` を unread view にも残すロジックが bulk action でも効いている可能性が高い
  - 候補箇所: `src/components/reader/article-list.tsx`, `src/lib/article-list.ts`, `src/__tests__/components/article-list.test.tsx`

## macOS / Windows 共存チェック

### ベストプラクティス

- [x] OS 判定は `PlatformInfo` / capability に集約し、UI 表示・機能可否・設定値の分岐を各画面に散らさない
- [x] release 対象と同じ OS を CI でも最低限検証し、`main` に入る前に Windows 固有の崩れを検知できるようにする
- [x] mac 専用タスク・コマンドは名前で明示するか `run_windows` を用意し、Windows での失敗を「仕様」として見える化する
- [x] ショートカットは「内部表現」と「OS ごとの表示ラベル」を分離し、mac は `⌘`、Windows は `Ctrl` を表示する
- [x] Tauri の OS 依存設定は config と runtime の二重管理を避け、どちらかを単一の source of truth にする

### 発見した具体項目

- [x] PR 向け CI が `ubuntu-latest` のみで、release の対象である macOS / Windows を継続検証できていない
  - `.github/workflows/ci.yml` は format / lint / test / build の全ジョブが Ubuntu 固定
  - `.github/workflows/release.yml` は `macos-latest` と `windows-latest` を配布対象にしている
  - まずは Windows の smoke build、可能なら macOS / Windows の最低限の test job を追加する
- [x] Windows では `mise run test:rust` を常に skip しており、ローカル DoD を再現できない
  - `mise.toml` の `run_windows` で `cargo test --test integration_test` を実行するよう変更
  - [x] `cargo test --lib` は Windows で引き続き `STATUS_ENTRYPOINT_NOT_FOUND`。テスト用 manifest を build.rs 側で埋め込み、通常ビルドとの衝突は `tauri-build` の app manifest を単一化して解消
- [x] `mise` のネイティブアプリ用タスクに mac 専用処理が混ざっている
  - `mise.toml` の `app:dev:signed` は `codesign` 前提
  - `mise.toml` の `app:open` は `/Applications/...`, `xattr`, `open` 前提
  - `app:mac:*` に寄せるか、Windows 用の代替タスク / 明示的な no-op を用意する
- [x] ショートカットの表示が mac 寄りで、Windows でも `⌘` を見せてしまう箇所がある
  - `src/lib/keyboard-shortcuts.ts` の既定値と表示整形が `⌘` ベース
  - `src/components/reader/command-palette.tsx` でも `⌘,` を固定表示している
  - 入力解決は `metaKey || ctrlKey` で吸収できているので、次は表示層を platform-aware にする
- [x] Tauri のタイトルバー設定が config と runtime で分かれており、非 macOS で意図が追いづらい
  - `src-tauri/tauri.conf.json` / `src-tauri/tauri.dev.conf.json` は `titleBarStyle: "Overlay"`
  - `src-tauri/src/lib.rs` では macOS だけ `Overlay`、それ以外は `Visible` を設定している
  - macOS 専用 config に分けるか runtime 設定に一本化して、将来の差分混入を防ぐ

## premortem で見えた詰めどころ

- [x] 同期失敗時の整合性ルールを明文化する
  - README に current sync consistency rules を追記し、`pending_mutations` の削除条件と remote state 適用順を明記した
  - 部分成功の細粒度リカバリは未実装であることも現状仕様として書いた
- [x] 記事 HTML / 埋め込み表示の CSP 方針を確定する
  - README に compatibility-first の current CSP policy を追記した
  - `script-src 'self'` を維持しつつ、`img-src http/https` と `frame-src http/https` は記事表示互換性のため許可していると明記した
- [x] README の release 説明と実際の workflow を一致させる
  - README は macOS Apple Silicon + Windows 前提へ修正し、`.github/workflows/release.yml` の実態と揃えた
  - workflow を増やすか README を現状に合わせるか決める
- [x] E2E / 手動確認の責務分担を決める
  - README に `test` / `test:e2e` / `test:live` / 手動確認の境界と verification matrix を追記した
