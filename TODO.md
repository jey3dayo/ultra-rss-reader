# Ultra RSS Reader — TODO

## 自動ワイドスクリーンの仕上げ

- [x] 自動ワイドスクリーン overlay の最終 polish を仕上げる
  - `×` の hover / active / focus-visible は現行の ghost affordance のまま維持し、active feedback を残した
  - `×` の hit area は `46px` へ広げ、実装とテストを更新した
  - lane の余白は close 導線として読める範囲に収まっており、browser mode / Tauri debug capture でも大きな違和感は見えなかった
  - scrim と stage の境界には細い border を追加し、黒同士で溶けすぎないよう半段だけコントラストを上げた
- [x] overlay の振る舞いを最終判断する
  - scrim クリックでは閉じず、close affordance と `Esc` を主導線として維持する
  - focus trap は入れず、overlay close button autofocus + focus restore で運用する
  - 開閉アニメーションは追加せず、hover / active / focus-visible の軽い反応だけに留める
  - `Esc` で閉じる / `focus-visible` を維持する方針で確定した
- [x] Tauri の実機スクショをループで取りながら、overlay の最終見た目を確定する
  - `image-viewer-overlay` dev intent 中は起動時 sync を抑止し、scenario の一時状態が同期で潰れないようにした
  - HWND capture で baseline / resized の window + client screenshot を撮り、overlay shell と native WebView の重なりを確認した
  - resize 後も `Webプレビュー` overlay が維持され、native WebView の bounds ずれが目立たないことを debug capture で確認した
- [x] 実機確認用の debug intent を、ノイズの少ない専用導線として作り直す
  - `app:dev:image-viewer` で overlay 直行と mock page 表示まで確認済み
  - 実 provider での最終確認は、overlay UI の見た目が固まってから別途詰める

## 情報設計と Web プレビューモードの整理

- [x] 右ペインを `Web プレビューモード` として明確にする
  - overlay 上端に `Webプレビュー` の固定コンテキストヘッダを追加し、記事タイトル / フィード名 / 投稿日を常時見えるようにした
  - 既存ツールバーの責務は変えず、文脈情報だけを薄い glass panel で補って mode 判別をしやすくした
  - 前後記事移動や追加操作の再配置は含めず、最小差分の UI 明確化に留めた
- [x] 左ペインの現在地をもう一段分かりやすくする
  - 選択中の項目の背景コントラストを少し上げる
  - 左端アクセントバーを追加する
  - 件数の文字色を少し弱めて、ラベル本体を主役にする
  - 折りたたみ階層の余白とグループ感をもう少し明確にする
- [x] 左ペインの情報階層を整理する
  - sidebar section split と smart view contextual filters により、`スマートビュー / フィード / タグ` の層を視覚的に分離した
  - 全体指標は smart view と context strip 側へ寄せ、各フィード件数との競合を弱めた
- [x] ツールバーとメニューバーの役割を整理する
  - メニューバーは低頻度操作、ツールバーは高頻度操作に寄せる
  - close 系 UI は「何を閉じるのか」が分かるように意味を揃える
  - overlay 中は `記事を閉じる` をツールバーから隠し、`Webプレビューを閉じる` を主導線に寄せた
  - `外部ブラウザ` は高頻度導線として toolbar に固定し、`コピーリンク` だけを toolbar 表示の設定対象に寄せた
  - share menu は常設とし、`コピーリンク` / `メール共有` / `Reading List` の低頻度共有操作をまとめる
- [x] UI 言語の混在を解消する
  - 主要画面で `Web preview` / `browser view` と混在していた表現を、`Webプレビュー` に寄せて統一した
  - shortcut 名、非対応メッセージ、主要操作ラベルも同じ語彙へ揃えた
- [x] 表示モードの整理方針を決める
  - UI 上の表示モード名を `記事本文` / `Webプレビュー` / `既定の表示` に整理した
  - 英語側も `Reader` / `Web Preview` / `Use default` に寄せ、`standard/preview` の曖昧さを解消した

## UI ブラウザ散策メモ

- [ ] Webプレビューが空のままになる場合でも、loading / failure / unsupported の状態を見分けられるようにする
  - 再現: ブラウザモード (`http://127.0.0.1:4173/`) で記事を1件開き、ツールバーの `Webプレビューを開く` を押す
  - 5 秒以上待っても右ペインが真っ黒のままで、`読込中` / 失敗理由 / 再試行導線のどれも見えず、単に固まったのか非対応なのか判断できない
  - loading 中は overlay 上に `読込中` と補助文言を重ね、完全な黒画面には見えないようにした
  - failure / unsupported の見分けと再試行導線はまだ残タスク
  - 候補箇所: `src/components/reader/browser-view.tsx`, `src/components/reader/article-view.tsx`, `src/locales/ja/reader.json`, `src/locales/en/reader.json`
- [x] 記事検索の 0 件状態を、空フィード時と見分けられる search-specific empty state にする
  - 再現: ブラウザモードで `記事を検索` を開き、`zzzzzz` のような一致しない語を入力する
  - 検索語を含む empty title と補助文言、`検索をクリア` 導線を追加した
  - 候補箇所: `src/components/reader/article-list.tsx`, `src/components/reader/article-list-header.tsx`, `src/locales/ja/reader.json`, `src/locales/en/reader.json`
- [x] フィード追加ダイアログで、無効な URL 入力時の理由と次アクションを inline に示す
  - 再現: `フィードを追加` を開き、`example.com` のように scheme なしの URL を入力する
  - `https://example.com` 形式の入力例を inline error として表示し、`検出` / `追加` disabled の理由を見えるようにした
  - 候補箇所: `src/components/reader/add-feed-dialog.tsx`, `src/components/reader/add-feed-dialog-view.tsx`, `src/locales/ja/reader.json`, `src/locales/en/reader.json`
- [ ] フィード管理の初期ビューで、低シグナルな summary card より整理キューを主役に寄せる
  - 再現: ブラウザモードのデスクトップ幅で `フィード管理` を開く
  - 初期表示は `候補数 / 優先確認 / あとで見る / 参照エラー` の card が大きく並ぶ一方、実際に判断する `整理キュー` と `確認` は下に押し出され、主タスクへ入るまでの視線移動が多い
  - とくに 0 件 card が多い状態では縦幅に対する情報密度が低く、cleanup 作業より dashboard 的な眺めに寄って見える
  - 候補箇所: `src/components/feed-cleanup/feed-cleanup-page-view.tsx`, `src/locales/ja/cleanup.json`, `src/locales/en/cleanup.json`

- [ ] UI/UX 監査で見つかった改善を小さいものから順に解消する
  - [x] 設定画面の日本語 UI に残っている英語混在ラベルを自然な日本語に直す
    - `Unread を表示` / `Starred を表示` / `Tags を表示`
    - 候補箇所: `src/locales/ja/settings.json`
  - [x] UI 文言の `...` を `…` に寄せて表記を統一する
    - loading / adding / placeholder / `〜...` 系のラベルを優先
    - 候補箇所: `src/locales/ja/*.json`, `src/locales/en/*.json`
  - [x] ダークテーマで `color-scheme: dark` を明示し、ネイティブ UI の見え方を安定させる
    - 候補箇所: `src/styles/global.css`
  - [x] モバイル幅で 32px 前後に留まっていた主要アイコンボタンのタップ領域を 44px 基準へ引き上げる
    - 再現: `375x900` の browser mode で、同期 / 追加は `28x28px`、サイドバー表示 / 検索 / すべて既読は `32x32px` に留まっていた
    - 対応: `button.tsx` の `icon` / `icon-sm` / `icon-xs` を mobile では `44px` にし、`md` 以上では従来サイズへ戻す
  - [ ] モバイル向け UI を正式対応する段階で、アイコンのみ導線の見直しを再開する
    - 現時点では mobile を主要提供面にしないため必須対応から外すが、狭い幅での discoverability 課題として保留する
    - 対応する場合は tooltip 前提の主要操作を、ラベル表示かメニュー集約で補う
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
