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

- [ ] P1 browser injected bridge listener lifecycle を検証する
  - 対象: `src-tauri/src/browser_webview.rs`
  - injected script が `window.addEventListener` と focus override を入れるため、navigation / reload / recreate 時に listener が重複しないか実機寄りに確認する
  - bridge install idempotence、mouse back/forward in-flight、close in-flight の contract test または manual verification を追加する

- [ ] P2 reader focus DOM selector drift を検出する
  - 対象: `src/lib/reader-focus.ts`, reader list/sidebar/account pane components
  - focus helper が data attribute selector に強く依存しており、view refactor で attribute が外れると keyboard navigation が silent fallback になりやすい
  - selector source of truth または repo contract test を追加し、主要 focus target attribute の存在を固定する

- [ ] P2 app foreground window show/focus error policy を整理する
  - 対象: `src-tauri/src/lib.rs`
  - second instance / foreground handling で `let _ = window.show(); let _ = window.set_focus();` と error を捨てており、packaged app の復帰失敗を追跡しにくい
  - expected unsupported と unexpected error を分けて log するか、manual verification に残すか決める

- [ ] P1 browser webview native emit failure diagnostics を補強する
  - 対象: `src-tauri/src/browser_webview.rs`, `src-tauri/src/commands/browser_webview_commands.rs`
  - browser state / close / fallback / diagnostics event の `app_handle.emit(...)` failure が `let _ =` で捨てられ、frontend listener 不在や payload serialization failure を追跡しづらい
  - expected listener-missing と unexpected emit failure を分け、diagnostics enabled 時だけ warn するかを native-side test / manual verification で固定する

- [ ] P1 browser webview focus native command failure policy を整理する
  - 対象: `src-tauri/src/browser_webview.rs`, `src-tauri/src/commands/browser_webview_commands.rs`
  - `webview.set_focus()` / Windows foreground API の戻り値を複数箇所で無視しており、overlay open 後に focus が戻らない packaged app 問題の原因が残らない
  - focus failure を UI に出すか diagnostics-only にするか決め、platform 別に expected failure と unexpected failure の log policy を固定する

- [ ] P2 article list retained snapshot duplicate identity contract を固定する
  - 対象: `src/lib/articles/article-list.ts`, `src/components/reader/hooks/article-list/use-article-list-data.ts`
  - retained article snapshot は Map で id 重複を後勝ち merge するため、same id with stale read/star state が source 間で競合した時の表示が未固定
  - retained snapshot stale、current source duplicate、search/tag/source切替の merge order を pure helper test にする

- [ ] P2 Rust app startup filesystem failure diagnostics を補強する
  - 対象: `src-tauri/src/lib.rs`, `src-tauri/build.rs`
  - app data dir 作成 / DB init / log cleanup で `expect` / `panic` / silent remove failure が混在しており、packaged startup failure の user-facing message が揺れやすい
  - app data permission denied、DB open failure、log cleanup permission denied の message と recovery guidance を native test / manual verification に分ける

- [ ] P1 same-URL webview timeout 世代管理を追加する
  - 対象: `src-tauri/src/commands/browser_webview_commands.rs`, `src-tauri/src/browser_webview.rs`
  - webview load timeout が URL 文字列だけで古い load と新しい reload/reopen を区別すると、同じ URL の再読込で stale timer が新しい webview を fallback close し得る
  - same URL reload、close -> reopen same URL、slow load completed after timeout の generation id contract を native/frontend event test にする

- [ ] P1 child webview command invoke 権限を検証する
  - 対象: `src-tauri/capabilities/default.json`, `src-tauri/src/browser_webview.rs`, `src-tauri/src/commands/browser_webview_commands.rs`
  - embedded webview bridge が native command を invoke する経路は capability / window label / webview label の前提が壊れると packaged app だけで失敗しやすい
  - main webview と child webview の permission 差を整理し、close bridge / back-forward mouse bridge の invoke 可否を manual verification に残す

- [ ] P1 startup remote-state repair 完了マークの部分成功条件を固定する
  - 対象: `src-tauri/src/commands/sync_commands.rs`, `src-tauri/src/commands/sync_providers.rs`
  - startup sync account と repair-only account が混在する時、失敗 ID 判定だけで repair preference を done にしてよいかが分かりにくい
  - repair-only success / normal sync failure / mixed provider failure の完了マーク条件を sync command test にする

- [ ] P2 sync progress total と実 sync 対象 snapshot を一致させる
  - 対象: `src-tauri/src/commands/sync_commands.rs`, `src/stores/ui-store.ts`
  - progress total 用 account list と実 sync 用 account list を別タイミングで読むと、途中の account 追加/削除で completed/total 表示がズレる可能性がある
  - account list changed during startup sync、disabled account skipped、manual single-account sync の progress total contract を固定する

- [ ] P2 feed HTTP cache と sync_state の責務重複を棚卸しする
  - 対象: `src-tauri/migrations/V1__initial.sql`, `src-tauri/src/commands/sync_providers.rs`, `src-tauri/src/infra/db/sqlite_sync_state.rs`
  - `feed_http_cache` と `sync_state` の etag / last_modified 管理が併存しており、local feed sync の source of truth が将来の migration で揺れやすい
  - 現在使っている cache table / dead table / migration compatibility を確認し、削除ではなく責務表を TODO に分割する

- [ ] P2 browser diagnostics preference 即時反映 contract を固定する
  - 対象: `src-tauri/src/lib.rs`, `src-tauri/src/browser_webview.rs`, `src-tauri/src/commands/preference_commands.rs`
  - native browser diagnostics flag が startup preference だけを読む場合、settings で Debug HUD を切り替えても native emit が即時追従しない可能性がある
  - preference update event / app restart required / frontend-only HUD のどれを正にするか決め、debug diagnostics の manual verification に残す

- [ ] P2 WSL Windows env forwarding secret suffix を補強する
  - 対象: `scripts/lib/windows-dispatch.ts`, `scripts/tauri-cli-dispatch.ts`, `src/__tests__/scripts/tauri-cli-dispatch.test.ts`
  - Windows dispatch の env allowlist で `VITE_*` / `TAURI_*` を広く通す場合、`*_SECRET` / `*_TOKEN` / `*_CREDENTIALS` が Windows 側へ漏れる可能性がある
  - forwarded env の secret suffix denylist と explicit allowlist を test で固定し、必要な dev env だけを通す

- [ ] P0 release tag と app/package/Cargo version の一致を release workflow で固定する
  - 対象: `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `.github/workflows/release.yml`
  - release tag と app/package/Cargo version がズレると、別バージョンの artifact を正規 release として配布できる
  - release workflow で tag、package version、Tauri bundle version、Cargo package version の parity を検証し、不一致なら artifact 作成前に失敗させる

- [ ] P0 add_local_feed の部分保存 rollback / partial success 契約を固定する
  - 対象: `src-tauri/src/commands/feed_commands.rs`, `src-tauri/src/commands/sync_providers.rs`, `src/hooks/use-add-feed.ts`
  - `add_local_feed` は feed 保存後に初回 sync へ進むため、初回記事取得が失敗した時に「追加失敗だが feed は残る」状態になり得る
  - feed persisted + initial sync failed の rollback / partial success / retry 導線を決め、user feedback と DB 状態を Rust test で固定する

- [ ] P1 dev credentials file store の atomic write / lost update 契約を固定する
  - 対象: `src-tauri/src/infra/keyring_store.rs`
  - dev credentials が `std::fs::write` 直書きだと、書き込み中断や並行 set/delete で JSON 破損・lost update になり得る
  - `write_dev_store` を temp file + rename か lock 方針へ寄せ、partial write、permission failure、連続 set/delete の test を追加する

- [ ] P1 dependency security audit gate を CI / release preflight へ入れるか決める
  - 対象: `mise.toml`, `.github/workflows/ci.yml`, `package.json`, `src-tauri/Cargo.toml`
  - frozen install と build はあるが、npm/Cargo の既知脆弱性 gate が未固定だと、release 直前まで supply-chain risk に気づけない
  - `pnpm audit` / Rust audit 相当を CI、release preflight、manual only のどこで落とすか決め、許容/除外リストの運用も TODO 化する

- [ ] P1 GitHub Actions の tag pin / SHA pin 方針を release workflow から固定する
  - 対象: `.github/workflows/ci.yml`, `.github/workflows/release.yml`
  - workflow actions が version tag 固定だけだと、release workflow の supply-chain 面が tag 移動や upstream 変更に依存する
  - release job だけ SHA pin するか全 workflow へ広げるかを決め、action pinning policy と更新手順を test / lint で検出できる形にする

- [ ] P1 Tauri unstable feature を release build で許可する条件を棚卸しする
  - 対象: `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/src/browser_webview.rs`
  - `tauri` に `unstable` feature が入っているため、release artifact で使ってよい API 面積と将来の breaking risk が明文化されていない
  - unstable API の使用箇所、必要理由、代替可能性、release smoke で見るべき挙動を一覧化し、不要なら feature を外す

- [ ] P1 feed discovery の resolved candidate URL に private / unsupported scheme filter を追加する
  - 対象: `src-tauri/src/infra/feed_discovery.rs`, `src/api/schemas/discovered-feed.ts`, `src/components/reader/hooks/feed-dialogs/use-add-feed-dialog-actions.ts`
  - fetch 先と redirect の検証があっても、HTML の `<base>` や `<link href>` から作られた候補 URL 自体の private / unsupported policy が別契約になりやすい
  - public page -> private base href、relative feed、duplicate candidate、unsupported scheme の contract test を追加する

- [ ] P1 provider HTTP response body size limit を決める
  - 対象: `src-tauri/src/infra/provider/local.rs`, `src-tauri/src/infra/feed_discovery.rs`
  - feed body / discovery HTML を読み切る経路があると、巨大 response や圧縮展開後サイズでメモリを食うリスクが残る
  - local feed fetch と feed discovery に response body size limit / timeout / error copy の契約を追加し、oversized feed / oversized HTML / compressed response の provider test を固定する

- [ ] P1 article thumbnail URL の sanitizer/privacy 境界を固定する
  - 対象: `src-tauri/src/infra/provider/normalizer.rs`, `src/api/schemas/article.ts`, `src/components/reader/article-list-item.tsx`, `src/components/reader/article-content-view.tsx`
  - `content_sanitized` は Rust sanitizer 境界がある一方、`thumbnail` は provider 由来 URL を `<img src>` に渡すため、remote image privacy と scheme policy が本文 HTML と別管理になりやすい
  - http/https/relative/data/private URL policy を決め、normalizer / ArticleDtoSchema / reader rendering の contract test を追加する

- [ ] P1 add feed dialog の form-level result announcement contract を追加する
  - 対象: `src/components/reader/add-feed-dialog-view.tsx`, `src/components/reader/feed-dialog-url-section.tsx`
  - URL field の invalid hint だけでなく、discover / submit の error と success が視覚表示だけになると支援技術へ通知されない可能性がある
  - URL field error と form-level result を分け、`role` / `aria-live` / `aria-describedby` の方針を accessibility test で固定する

- [ ] P1 command palette dialog の accessible name contract を固定する
  - 対象: `src/components/reader/command-palette.tsx`, `src/components/ui/command.tsx`
  - Dialog title / description が popup content 外に置かれる構造だと、dialog の accessible name / description association が壊れても検出しにくい
  - command palette と shared CommandDialog で `getByRole("dialog", { name })` が通る contract test を追加する

- [ ] P1 mirrored theme localStorage fallback の責務を固定する
  - 対象: `src/stores/preferences-store.ts`, `src/constants/storage.ts`, `src/schemas/storage.ts`
  - theme は DB preference の mirror として localStorage にも保存されるが、DB load failure や invalid mirror の時にどちらを source of truth にするかが曖昧
  - DB preference missing、DB load failure、invalid localStorage theme、storage unavailable の時の適用 theme と mirror 更新方針を store test で固定する

- [ ] P2 Tauri CSP の external img/frame 許可面積を feed content / browser webview 境界で整理する
  - 対象: `src-tauri/tauri.conf.json`, `docs/feed-content-privacy.md`, `src/components/reader/article-content-view.tsx`
  - CSP で `img-src` / `frame-src` が `http:` / `https:` を広く許可している場合、feed content と browser webview の責務境界が security config 上で見えにくい
  - reader thumbnail、sanitized article body、Web Preview、child webview の許可面積を threat model と manual verification に分ける

- [ ] P2 package / Tauri bundle metadata の release artifact 表示項目を source of truth 化する
  - 対象: `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/tauri.release.conf.json`, `src-tauri/Cargo.toml`
  - package metadata と bundle metadata の責務が曖昧だと、配布 artifact の表示名、publisher、copyright、category が release ごとに drift する
  - release artifact に出る metadata を一覧化し、どのファイルを source of truth にするかを schema test で固定する

- [ ] P2 OPML import の feed title / folder name normalization を通常 validation と揃える
  - 対象: `src-tauri/src/infra/opml.rs`, `src-tauri/src/commands/opml_commands.rs`, `src-tauri/src/commands/feed_commands.rs`
  - OPML の `title` / folder name が create/rename validation と別経路で DB に入ると、空文字、長大文字列、制御文字、重複 folder の扱いが揺れる
  - trim、長さ、blank fallback、duplicate normalized folder の契約を決め、blank folder / long title / control char の Rust test を追加する

- [ ] P2 OPML export の XML round-trip 契約を固定する
  - 対象: `src-tauri/src/infra/opml.rs`, `src-tauri/src/commands/opml_commands.rs`
  - export XML 自体の control char replacement、folder order、import round-trip が未固定だと、download UI が成功しても他 reader で壊れる OPML になり得る
  - XML 1.0 invalid char、folder sort order、export -> parse round-trip を fixture test で固定する

- [ ] P2 article list grouped listbox semantics を固定する
  - 対象: `src/components/reader/article-list-screen-view.tsx`, `src/components/reader/article-groups-view.tsx`, `src/components/reader/article-list-item.tsx`
  - `role="listbox"` 配下の group header / wrapper / option の関係が曖昧だと、日付グループ見出しが支援技術へ安定して伝わらない可能性がある
  - `role="group"` / `aria-labelledby` / option 構造の方針を決め、grouped article list の accessibility contract test を追加する

- [ ] P2 settings navigation の selection semantics を整理する
  - 対象: `src/components/settings/settings-nav-view.tsx`, `src/components/settings/accounts-nav-view.tsx`, `src/components/shared/nav-row-button.tsx`
  - settings modal 内のカテゴリ/アカウント切替が `aria-current` と `aria-pressed` を併用しており、navigation / tabs / radio 相当の操作モデルが曖昧
  - 現行 keyboard 操作を維持するか arrow key selection を足すか決め、selected state の role/aria contract を test で固定する

- [ ] P2 sidebar expanded folders localStorage の prune / write contract を固定する
  - 対象: `src/components/reader/hooks/sidebar/use-sidebar-startup-folder-expansion.ts`, `src/schemas/storage.ts`, `src/constants/storage.ts`
  - expanded folders は localStorage 永続化だが、保存時にも schema cap/prune を通さないと古い account id や巨大 map が残り続けやすい
  - 保存時の account/folder id normalization と上限を適用し、unknown account accumulation、oversized map、storage write failure の test を追加する

- [ ] P2 feed folder update の missing folder / concurrent delete message を分ける
  - 対象: `src-tauri/src/infra/db/sqlite_feed.rs`, `src-tauri/src/commands/feed_commands.rs`, `src/components/reader/hooks/sidebar/use-sidebar-feed-drag-state.ts`
  - `feed not found or folder does not belong to feed account` に missing feed、missing folder、cross-account folder、concurrent folder delete が混ざると、UI rollback と toast の原因分類ができない
  - affected row 0 の原因を分けるか log diagnostic を追加し、concurrent folder delete / missing feed / cross-account folder の DB test を追加する

- [ ] P2 mute keyword auto mark read の long transaction / partial failure contract を固定する
  - 対象: `src-tauri/src/commands/mute_keyword_commands.rs`, `src-tauri/src/infra/db/sqlite_article.rs`
  - mute keyword 作成・更新時に全 account の muted unread を mark read するため、対象記事が多い時の long transaction、途中失敗、UI feedback の境界が曖昧になりやすい
  - preference enabled 時の対象 account snapshot、partial failure、large article set の処理方針を Rust test / manual verification に分けて固定する

- [ ] P2 tag article/untag missing target の no-op policy を固定する
  - 対象: `src-tauri/src/infra/db/sqlite_tag.rs`, `src-tauri/src/commands/tag_commands.rs`, `src/components/reader/hooks/article/use-article-tag-picker-popover.ts`
  - `INSERT OR IGNORE` / `DELETE` の affected row を user-visible にしない場合、missing article/tag や concurrent delete が成功扱いになり、UI cache と DB がズレたまま見える可能性がある
  - missing article、missing tag、already tagged、already untagged の no-op / error 方針を決め、tag picker の optimistic update contract と合わせて test する

- [ ] P3 frontend localStorage key registry の coverage contract を追加する
  - 対象: `src/constants/storage.ts`, `src/schemas/storage.ts`, `src/__tests__/constants/storage.test.ts`, `src/__tests__/schemas/storage.test.ts`
  - storage key が増えても schema / owner / cleanup 方針の対応表がないと、localStorage 境界の追加時に validation 漏れが起きやすい
  - `STORAGE_KEYS` の各 key に schema、owner、cleanup 方針があるかを fixture で照合し、新規 key 追加時に境界未定義を検出する

- [ ] P3 feed content privacy hardening の実測タスクを docs checklist と接続する
  - 対象: `docs/feed-content-privacy.md`, `TODO.md`
  - privacy hardening の大枠 TODO だけだと、reader thumbnail、sanitized body remote media、Web Preview の実測観点が混ざりやすい
  - `docs/feed-content-privacy.md` の checklist と TODO の実行単位を対応させ、manual verification を reader thumbnail / sanitized body / Web Preview に分割する

## 次の並列バッチ候補

- [ ] P3 TypeScript feature-local `.types.ts` split 候補を追加する
  - feature-local 候補: `src/components/reader/feed-tree.types.ts`、`sidebar.types.ts`、`sidebar-feed-section.types.ts`、`article-list.types.ts`、`browser-view.types.ts`、`command-palette.types.ts`、`add-feed-dialog.types.ts`、`rename-feed-dialog.types.ts`、`src/components/settings/settings-page.types.ts`、`settings-nav.types.ts`、`settings-modal.types.ts`、`account-detail/types.ts`
  - Props / Params / Result が同じ file に混在している箇所を、view contract / controller contract / hook-local contract の小バッチに分けて整理する
  - runtime behavior は変えず、feature 内 consumer が多い型の責務分割と name clarity だけを扱う

- [ ] P3 TypeScript local-only exported Props/Params/Result 候補を追加する
  - local-only 候補: `src/components/settings/add-account/form-view.types.ts`、`src/components/reader/sidebar-runtime.types.ts`、`sidebar-sources.types.ts`、`article-actions.types.ts`
  - exported `*Props` / `Use*Params` / `Use*Result` の consumer が 1 runtime component / 1 hook group / story-only に閉じるものを owner file へ戻せるか確認する
  - public contract 候補とは分け、localized type の export 削減だけを扱う

- [ ] P3 react-doctor dead code type surface 候補を追加する
  - `knip/types` / `knip/exports` の unused type/export を feature ごとに棚卸しする
  - `article-list.types.ts` / `browser-view.types.ts` / `command-palette.types.ts` など広い contract は一括削除せず参照範囲ごとに分ける
  - public wrapper API と Storybook helper export は allowlist 化し、実 dead code だけを削除する

- [ ] P3 react-doctor many boolean props decomposition 候補を追加する
  - `react-doctor/no-many-boolean-props` の対象 component を action group / named variant / discriminated props へ分割できるか確認する
  - 対象候補: `ArticleToolbarMoreMenu` / `sidebar-header-view` / `command-palette-resource-groups` / `sidebar-content-sections` / `command-palette-results`
  - toolbar taxonomy や command palette grouping 再設計とは分け、boolean prop surface の読みやすさと誤用防止だけを扱う

- 次に大きな UI バッチを始めるときは、必要な write scope ごとにここへ再追加する

- [ ] P3 参照範囲が広い root-level type を別バッチで分割する
  - reader selection は `src/lib/reader/reader-selection.types.ts` を source of truth にする。新しい `UiSelection` alias は増やさない
  - さらに state type を分割する場合は、`src/stores/ui-store.ts` 自体を slice 化できる段階で実施する。store action / selector / dev scenario への参照が広いため別バッチにする

- [ ] P3 小粒 cleanup 候補を別バッチで見直す
  - UI class variant の追加テストは shared component の semantic token / role contract に限定する。hover 全量や visual snapshot は固定しない
  - pure helper の追加テストは、article list selection / navigation / grouping / mark-all-read count など挙動の契約として価値があるものだけ残す
  - view-level props の `export type` は hook / Storybook / tests の contract として使うものだけ残す。外部 import がない helper props は触るファイルごとに local type へ戻す
  - reader の残りは browser geometry など参照範囲が広い単位で見直す
  - `src/components/ui/` の primitive wrapper props は shadcn/Base UI wrapper API として扱う。外部 import がなくても、公開 wrapper contract の方針を決めるまでは一括 local 化しない
  - shared component の `.types.ts` は、複数ファイルで共有する contract だけ残す。`dialog.types.ts` の `ConfirmDialogVariant` のように store / view にまたがるものは、呼び出し境界が変わる時に見直す
  - Browser geometry の数値固定や picker 専用 chip variant の網羅は参照範囲が広く、実機/呼び出し側 layout 影響を見てから別バッチで扱う

- [ ] P2 app shell / keyboard boundary 整理候補を別バッチで見直す
  - global keyboard handling に reader pane 固有の分岐が増えていないか、pane helper へ戻せるものを棚卸しする
  - focus return / selected sidebar target / selected article row の復帰処理は、reader focus helper と hook の責務境界を先に整理する
  - shortcut の表示ラベル変更や i18n copy 変更は、挙動整理と同じバッチに混ぜない

- [ ] P3 store slice boundary 整理候補を別バッチで見直す
  - `ui-store.ts` の reader selection / layout state / settings modal / toast / sync progress / account setup session を、参照範囲ごとに slice 化できるか確認する
  - `preferences-store.ts` は schema と永続化 contract があるため、UI store 分割とは同じバッチに混ぜない
  - store selector の import 先が多いため、まずは type alias / action group の棚卸しだけ行い、挙動変更は避ける

- [ ] P3 Storybook UI reference 分割候補を別バッチで見直す
  - `ui-reference-canvas-specimens.tsx` が大きくなっているため、foundations / controls / workspace / settings / navigation の specimen 群へ分割できるか確認する
  - visual specimen の copy や className 変更はデザイン差分になるため、まずは export / import 境界だけを整理する
  - `storybook-explorer-organization.test.ts` が期待する構成を先に確認し、story title / canvas 名を変えない

- [ ] P2 shared workspace layout contract 整理候補を別バッチで見直す
  - `workspace-pane-layout.ts` と `app-layout.tsx` の pane sizing / shell boundary / responsive constraints を、shared layout contract と app shell usage に分けられるか確認する
  - layout token や CSS class の変更は visual impact があるため、まずは型・helper配置と tests の責務整理に限定する
  - app shell の overlay / debug HUD / modal collision とは別バッチにする

- [ ] P1 Tauri menu / shortcut contract 整理候補を別バッチで見直す
  - `src-tauri/src/menu.rs` / `menu_i18n.rs` と frontend shortcut handling の action id 対応を一覧化する
  - menu label の i18n と frontend shortcut 表示は別レイヤーなので、まずは action id と emitted event の contract test を優先する
  - native menu の checked state と UI preference state の同期は挙動影響があるため、型・テスト整理とは分ける

- [ ] P1 Rust DB repository test 候補を別バッチで追加する
  - sqlite account / feed / folder / article / tag / sync state repository の境界値を、migration 適用済み DB fixture で固定する
  - WAL / SHM や app data path の運用検証とは分け、repository method の入出力契約に限定する
  - 既存 integration test が広い場合は、repository ごとの小さい fixture helper を先に作る

- [ ] P1 updater / release readiness 検証候補を別バッチで見直す
  - `.github/workflows/release.yml`、`src-tauri/tauri.conf.json`、`updater_commands.rs` の updater 設定・署名・fallback を確認する
  - local test で固定できる設定検証と、実 release artifact が必要な検証を分ける
  - release note / manual verification docs への反映は、実際の release 作業とは別コミットにする

- [ ] P0 provider / sync flow boundary 整理候補を別バッチで見直す
  - `sync_flow.rs` / `sync_scheduler.rs` / provider traits / greader provider の責務を、provider adapter と app sync orchestration に分けて棚卸しする
  - pending mutation / sync state / account sync status はデータ整合性に関わるため、UI sync feedback の型整理とは混ぜない
  - network error / auth error / rate limit など失敗種別は domain error contract の test を先に固定する

- [ ] P1 feed content privacy hardening 候補を別バッチで設計する
  - `docs/feed-content-privacy.md` の方針に沿って、reader mode remote image / frame / sanitizer version の実測観点を整理する
  - CSP や sanitizer を一括で締めず、provider compatibility と Web Preview 影響を分けて検証する
  - privacy mode や tracking pixel 対策を入れる場合は、settings UI と Rust sanitizer の境界を別々に扱う

- [ ] P2 GitHub workflow / issue template 整理候補を別バッチで見直す
  - `.github/workflows/*` と issue templates の label / release-readiness / manual-verification 表現を、運用ラベルの source of truth に揃える
  - labeler config と PR insights の自動付与は既存運用に影響するため、CI workflow 変更とは別バッチにする
  - release workflow の artifact matrix と updater signing は、docs 更新だけでなく実 release dry-run の観点を残す

- [ ] P1 native menu checked state 同期候補を別バッチで検証する
  - `src-tauri/src/menu.rs` の check menu item toggle と frontend preference state が、view filter / sort unread / group by feed でズレないか確認する
  - menu action emit の contract test と、実 native menu の checked 表示確認を分ける
  - i18n label や shortcut 表示変更は locale/copy batch に残し、ここでは state sync と event ordering だけを見る

- [ ] P0 credentials / keyring verification 候補を別バッチで整理する
  - `src-tauri/src/infra/keyring_store.rs` と account detail credentials editor の保存/更新/削除/restart 復元を、native keyring と dev credentials で分けて検証する
  - `.env` や実 credential 値は扱わず、存在確認・失敗種別・fallback 表示の contract test と packaged manual verification に分ける
  - FreshRSS connection verification と keyring 保存はユーザー影響が違うため、provider login flow の refactor とは混ぜない

- [ ] P1 sanitizer / article content migration 候補を別バッチで検証する
  - `src-tauri/src/infra/sanitizer.rs`、`sanitizer_version`、`article_content_text` migration の関係を、保存済み記事と新規同期記事で分けて確認する
  - privacy hardening とは別に、既存記事の再 sanitize 条件、検索用 text extraction、malformed HTML の fallback を test で固定する
  - CSP や remote image policy は privacy batch に残し、ここでは content normalization と migration compatibility に限定する

- [ ] P1 feed discovery / add feed pipeline 候補を別バッチで検証する
  - `src-tauri/src/infra/feed_discovery.rs`、`opml_commands.rs`、add feed dialog actions の URL normalization / discovered feed option / folder assignment を分けて確認する
  - discovery failure と submit failure は表示 copy と retry 導線が違うため、dialog view props 整理とは混ぜない
  - 実 network が必要な確認は manual verification に回し、parser/DTO/command response は fixture test で固定する

- [ ] P1 screen snapshot / first-screen readiness 候補を別バッチで検証する
  - `use-screen-snapshot.ts`、startup account/feed selection、SQLite first screen snapshot の復元条件を、startup read model と UI fallback で分けて確認する
  - app launch 直後の loading skeleton、last selected account、recent article history は UX 影響が大きいため、fixture test と app smoke を分ける
  - DB migration や sync-on-startup と同時に変えると原因が追いにくいため、first-screen readiness の契約だけを先に固定する

- [ ] P2 workspace pane / mobile recovery layout 候補を別バッチで見直す
  - `workspace-pane-layout.ts`、`app-layout.tsx`、mobile pane recovery の pane sizing / focus target / back affordance を棚卸しする
  - desktop 3-pane layout と mobile recovery は責務が違うため、responsive class 変更より先に layout state の contract test を追加する
  - browser overlay geometry と Debug HUD overlay は別バッチに残し、ここでは reader pane と settings modal の shell boundary に限定する

- [ ] P1 feed tree drag/drop interaction contract 候補を別バッチで見直す
  - `feed-tree-drag-session.ts`、drop target、hover target、folder flow の drag outcome を、pointer session と repository update action で分けて棚卸しする
  - drag overlay motion や visual token は motion/browser 実機検証に残し、ここでは valid/invalid drop target と folder assignment result を固定する
  - touch/mobile drag は desktop pointer drag と前提が違うため、mobile recovery layout とは別の manual verification にする

- [ ] P1 provider normalizer / account DTO contract 候補を別バッチで検証する
  - `src-tauri/src/infra/provider/normalizer.rs`、provider traits、account DTO schema の display name / icon URL / capability flags を対応表で確認する
  - FreshRSS / GReader / local provider は認証・検索対応・delta sync の前提が違うため、provider ごとに fixture を分ける
  - account settings UI の表示 copy 変更は含めず、provider response normalization と frontend schema compatibility に限定する

- [ ] P0 account setup lock / session contract 候補を別バッチで見直す
  - `account-setup-session.types.ts`、add account controller、accounts nav の setup session lock を、wizard flow と settings navigation で分けて棚卸しする
  - duplicate submit / navigation away / failed credential verification はデータ破損につながるため、UI copy より先に state machine の境界を固定する
  - service picker の visual や provider icon 変更は含めず、setup session ownership と cancel/retry contract に限定する
