# Store Screenshot Capture Design

Issue: [#657](https://github.com/jey3dayo/ultra-rss-reader/issues/657)

## Summary

Microsoft Store 掲載用スクリーンショットを、規約に沿った撮影用シードから、コマンド 1 回で再生成できるようにする。

- アカウント表示名は、EN シードの `name` だけを中立な名前（`Personal`）に変える。実アプリでも表示名はユーザーが付けるものなので、実態と矛盾しない
- 撮影する状態は、撮影用 dev シナリオを 1 つ追加して固定する。既存の `open-feed-first-article` は構図が変わり、選ばれるフィードも安定しないので使わない
- テーマは、EN デモの preference を `theme: "system"` にしたうえで、Playwright の `colorScheme` で dark / light を切り替える
- 撮影スクリプトは Node から vite と Playwright を直接起動する。時計・タイムゾーン・外部通信を固定し、撮影後に DOM を検査してから画像を書き出す
- Store 提出用は PNG（Store の必須形式）、README / LP 用は JPG とし、同じ描画状態から両方を書き出す

## Problem

Store 再提出（v0.67.27.0）で、英語（米国）掲載のスクリーンショットが認定ポリシー 10.1.1.3（Inaccurate Representation）で差し戻された。
掲載画像は dev mock の EN シード（`src/dev/mock-data-demo-en.ts`）を描画したもので、アカウント表示名 `FreshRSS` がサイドバー左上の大見出し（`account-switcher-view.tsx` の `h1`）に出て、画面の看板になっていた。

調査で、次の問題も見つかった。

| 問題 | 根拠 |
| --- | --- |
| 撮影手順が文書化されておらず、再現できない | 現行画像は Unread スマートビューで 4 件目の記事を開いた状態だが、この状態を作る手順がどこにもない |
| 右下に dev 専用の Agentation ツールバーが写っている | `debug_agentation_visibility` の既定値が `"always"`（`src/schemas/preference-values.ts`） |
| 日付が撮影日によって変わる | EN シードの公開日時は `getCurrentDate()` からの相対値。現行画像には `MONDAY, AUGUST 17, 2026` と出ている |
| 実在サイトのロゴが写る経路がある | Video フォルダの 2 フィードの `site_url` が `https://www.youtube.com`。`FeedFavicon` は Google の favicon エンドポイントから実ロゴを取得する |
| Store 提出形式と合っていない | Store のスクリーンショットは PNG 必須（[Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/screenshots-and-images)）。現行のコミット済み画像は JPG だけ |
| `app:dev:browser:demo-en` が Windows で動かない可能性が高い | `run = "VITE_DEV_MOCK_LOCALE=en vite ..."` は POSIX シェルの書き方で、`run_windows` もない |

## Goals

- 第三者の製品名・ロゴ・実在サイトのコンテンツが写らない撮影用シードにする
- 撮影状態（データ、選択中の記事、テーマ、日時、サイズ）をコードで固定し、誰が実行しても同じ状態・構図の画像が出る
- `pnpm run capture:screenshots` 1 回で dark / light の 2 枚を生成する
- 撮影規約を `docs/` に明文化する

## Non-goals

- Partner Center での画像差し替えと再提出（Issue の範囲外）
- JA シード（`src/dev/mock-data.ts`）の整備。撮影には使わない（決定 1 を参照）
- 4 枚以上の Store 用スクリーンショットの追加
- 画素単位で OS 間一致させること（決定 6 を参照）

## 決定 1: アカウント表示名

### 実アプリでの表示名の扱い（確認済み）

- 表示名はアカウント追加時にユーザーが任意で入力する。空欄なら `input.kind`（`"FreshRss"`）が入る（`src/lib/account/add-account-form.ts` の `buildAddAccountPayload`）
- 追加後も設定画面から改名できる（`rename_account` コマンド）
- サイドバー左上の `h1` は表示名そのもので、サービス種別は出ない

つまり、`Personal` のような名前が見出しに出るのは、ユーザーが名前を付けたときの実際の表示と同じである。

### 比較

| 案 | 内容 | 評価 |
| --- | --- | --- |
| A（推奨） | EN シードの `mockAccountSeedsEn[0].name` を `"Personal"` に変える。`id: "acc-freshrss"`、`kind: "FreshRss"`、`server_url` は変えない | 変更は 1 行。実態どおり（FreshRSS で同期するアカウントにユーザーが名前を付けた状態）。`id` と `kind` は画面に出ないので、変える理由がない |
| B | 撮影時に `Local` アカウントへ切り替える | EN シードのフォルダとフィードはすべて `acc-freshrss` に属し、`Local` は空。データの付け替えが必要で、変更が大きい |
| C | 撮影用シナリオの中で表示名を書き換える | シードと画面の表示名が食い違い、シナリオの責務（state の再現）を超える |

名前の候補は `Personal` を推奨する。ユーザーが付けそうな一般名詞で、製品名に見えない。`My Feeds` や `Home` でもよい。

### JA シード

JA シードは撮影に使わず、この Issue では変更しない。

- JA シードは `AUTOMATON`、マガポケ、ジャンプ+ など実在サイト名を含むので、表示名だけ直しても撮影用の規約を満たせない
- JA シードは日常の開発と多数のテストの既定データでもある。`dev-mock-data-demo-en.node.test.ts:124` は JA シードの目印として `"FreshRSS"` を使っている
- README.ja と LP の日本語版も EN の画像を使っている

撮影規約に「撮影は EN シードだけで行う。JA シードは実在サイト名を含むので撮影に使わない」と明記する。

### Video フィードの URL

Video フォルダの 2 フィード（`feed-video-lab`、`feed-indie-dev-cast`）と、その記事の URL を `https://www.youtube.com/...` から `https://example.com/...` 系へ置き換える。

- `FeedFavicon` は `site_url` のホストで Google の favicon エンドポイントを引くので、YouTube のままだとフォルダを開いた構図で YouTube のロゴが写る
- 本番コードと既存テストに YouTube URL へ依存する箇所は見つからなかった（`src/` で `youtube` を含むのは 2 つのシードファイルだけ）。実装時にもう一度確認する
- 撮影スクリプト側でも外部通信を遮断する（決定 3）。シードの修正と通信遮断の二重で防ぐ

## 決定 2: 状態の再現方式

### `open-feed-first-article` を使わない理由

- フィードを選んで `setViewMode("all")` で開くので、現行画像（Unread スマートビュー）と構図が変わる
- フィードの選択順位は `DEFAULT_DEV_FEED_HINTS`（マガポケ、ジャンプ+ など JA 向け）で決まる。EN シードでは 1 件も当たらず、未読数の順でたまたま選ばれる
- `selectArticle` を engagement 指定なしで呼ぶので `"reading"` になり、既定の `after_reading: "after_0_3s"` で撮影直前に既読化が走る。未読バッジの数が撮影タイミングで変わる

### 推奨: 撮影用シナリオを 1 つ追加する

シナリオ ID は `open-unread-showcase-article` とする（既存の `open-*` 命名に合わせる）。処理は次のとおり。

1. アカウント一覧の先頭アカウントを選ぶ（`ctx.ui.selectAccount`）
2. Unread スマートビューを選ぶ（`ctx.ui.selectSmartView("unread")`）
3. 定数で指定した記事 ID（EN シードの `art-en-3`、現行画像と同じ記事）を `engagement: "preview"` で選ぶ
4. 記事が見つからない場合は、他のシナリオと同じく toast を出して終える

engagement を `"preview"` にするため、`DevScenarioContext.ui.selectArticle` の型に省略可能な `options` 引数を足す。ストア側の `selectArticle(id, options)` はすでに `engagement` を受け取れるので、本体の変更は不要である。`preview` なら既読化が走らず、未読バッジの数が固定される。

起動時の自動着地（Unread スマートビューの先頭記事を `preview` で開く処理、`article-view.tsx`）に頼る案は採らない。製品側の着地ロジックが変わると、撮影画像の構図が黙って変わるからである。

`.claude/rules/dev-scenarios-command-palette.md` に従い、追加時は次を更新する。

- `src/dev/scenario-ids.ts`、`src/dev/scenarios/registry.ts`、`src/dev/scenarios/import-registry.ts`
- `src/__tests__/dev/scenarios/registry.test.ts`、`src/__tests__/dev/intent.node.test.ts`（`DEV_SCENARIO_IDS` を回すので自動で対象になる）
- `src/__tests__/dev/scenarios/runner.node.test.ts` に、選ばれるアカウント・スマートビュー・記事 ID・engagement を固定するテストと、記事が見つからないときの toast のテストを足す

### テーマと dev 専用 UI の固定

`src/dev/mock-state.ts` の `seedDevMockPreferencesForLocale()` は、EN のとき `language: "en"` を入れている。ここに次の 2 つを足す。

| preference | 値 | 理由 |
| --- | --- | --- |
| `theme` | `"system"` | 既定値は `"light"`。`"system"` にすると `prefers-color-scheme` に追従するので（`src/lib/settings/preferences-appearance-dom.ts`）、Playwright の `colorScheme` で dark / light を切り替えられ、1 回のサーバー起動で 2 枚撮れる |
| `debug_agentation_visibility` | `"off"` | 既定の `"always"` だと dev 専用の Agentation ツールバーが写る。ツールバーは Shadow DOM に描画されるので、CSS で隠す方法は不安定 |

EN デモはもともと README / LP の撮影用に用意されたものなので、この 2 つを EN デモ全体の既定にしても用途と矛盾しない。`resetDevMockDataState()` もこの関数を呼び直すので、リセット後も値は保たれる。

localStorage に残るテーマのキャッシュは、ちらつき防止用で、preferences の読み込み後に上書きされる。撮影は毎回新しいブラウザコンテキストで行うので、影響しない。

## 決定 3: 撮影スクリプト

### 形態

`scripts/capture-store-screenshots.ts` に単体の Node スクリプトを置き、`node` で実行する（`scripts/tauri-dev-vite-manager.ts` と同じ実行方法）。Playwright は `@playwright/test` から `chromium` を import して使う。新しい依存は追加しない。

Playwright Test の設定ファイル（`playwright.screenshots.config.ts`）と spec を使う案もあるが、採らない。

- 既存の `playwright.config.ts` は `testDir: "./e2e"` なので、`e2e/` に置くと通常の E2E に拾われる
- 撮影は合否を判定するテストではなく、成果物を書き出す処理である
- `--publish` のような引数を素直に受け取れる

### 起動

Issue は `mise run app:dev:browser`（port 4173）での起動を指定している。ただし撮影には `VITE_DEV_MOCK_LOCALE=en` と `VITE_DEV_INTENT=open-unread-showcase-article` が必要で、vite の環境変数は起動時に固定される。mise タスクの `VAR=value cmd` 形式は Windows のシェルで動かない可能性が高い。

そこでスクリプトは、`app:dev:browser` と同じ引数（`--host 127.0.0.1 --port 4173 --strictPort`）で vite を自分で起動する。

- `child_process.spawn(process.execPath, [<vite の bin>, ...])` で起動し、環境変数は `spawn` の `env` で渡す。シェルを経由しないので、Win / Mac で同じように動く
- `--strictPort` なので、4173 番を他のサーバーが使っていたら起動に失敗する。そのときは「既存の `app:dev:browser` を止めてから実行する」旨のエラーを出して終える。環境変数の異なる既存サーバーを再利用すると別のシードで撮ってしまうので、再利用はしない
- 撮影が終わったら、成功でも失敗でも vite のプロセスを止める

### 撮影条件

| 項目 | 値 | 目的 |
| --- | --- | --- |
| viewport | 1600 × 900 | 現行画像と同じ構図 |
| `deviceScaleFactor` | 2 | 出力 3200 × 1800（現行と同寸。Store の desktop 要件 1366 × 768 以上、最大 3840 × 2160 を満たす） |
| `colorScheme` | `"dark"` / `"light"` | テーマの切り替え（決定 2） |
| `locale` | `"en-US"` | 日付と数値の書式を固定 |
| `timezoneId` | `"UTC"` | OS のタイムゾーンに左右されない |
| 時計 | `page.clock.setFixedTime(<固定日時>)` を `page.goto` の前に呼ぶ | シードの相対日時と `TODAY` の区切りを固定。固定日時は日付の境目から離れた昼の時刻にする |
| `reducedMotion` | `"reduce"` | 遷移途中を撮らない |
| 外部通信 | `context.route` で `127.0.0.1:4173` 以外へのリクエストを中止する | ファビコンを頭文字のフォールバックに固定し、実在ロゴの混入とネットワーク依存をなくす |

### 撮影前の DOM 検査

画像を書き出す前に次を確かめ、1 つでも満たさなければ失敗で終える。

- サイドバーの見出し（`h1`）が `Personal` で、`FreshRSS`（大文字小文字を問わない）を含まない
- 記事ペインの見出しが、指定した記事のタイトルと一致する
- Unread スマートビューが選択されている
- `html` 要素のテーマが `colorScheme` と一致する
- Agentation ツールバーと toast が表示されていない
- `document.fonts.ready` が解決している

### 出力

同じ描画状態から `page.screenshot()` を 2 回呼び、PNG と JPG を書き出す。画像変換の依存は追加しない。`animations: "disabled"` と `caret: "hide"` を指定する。

| 形式 | 用途 | 出力先 |
| --- | --- | --- |
| PNG | Store 提出（PNG 必須） | `docs/assets/store/screenshot-reader-{dark,light}.png` |
| JPG | README、README.ja、LP | `docs/assets/screenshot-reader-{dark,light}.jpg` と `site/assets/` の同名ファイル |

JPG の `quality` は、現行画像（各約 330 KB）と同程度のサイズになる値を実装時に決め、定数にする。書き出した画像は、ファイルヘッダーから幅と高さを読み、3200 × 1800 であることを確かめる。

`site/README.md` は `docs/assets/` を正本、`site/assets/` をそのコピーと定めているので、スクリプトは `docs/assets/` に書いたファイルを `site/assets/` へコピーする。

### コマンド

| package.json script | 動作 |
| --- | --- |
| `capture:screenshots` | `node ./scripts/capture-store-screenshots.ts`。`tmp/screenshots/store/` に 4 ファイル（PNG / JPG × dark / light）を書き出す。試し撮り用 |
| `capture:screenshots:publish` | `node ./scripts/capture-store-screenshots.ts --publish`。上の出力先表のとおり `docs/assets/` と `site/assets/` に書き出す |

Issue の規約「試し撮りはコミットしない（`tmp/screenshots/` に出す）」に合わせ、既定の出力先は `tmp/` にする。

## 決定 4: 撮影規約ドキュメント

ファイルは `docs/store-screenshots.md` とする。`docs/release-manual-verification.md` と同じ形式の frontmatter（`type: checklist` など）を付け、`docs/README.md` の索引と routing に 1 行ずつ足す。`site/README.md` の Assets 節からもリンクする。

章立て:

1. **Purpose** — 対象画像（`docs/assets/`、`site/assets/`、Store 提出用 PNG）と、この規約が必要になった経緯
2. **Policy background** — 10.1.1.3 の指摘内容（Microsoft の注記の原文）と Issue #657 の経緯。「FreshRSS という単語が禁止なのではなく、第三者の製品名が画面の主役になったことが問題」という整理
3. **Data rules** — 撮影は EN シードの撮影用状態だけで行う。実データ、実アカウント、実サーバーで撮らない。JA シードは実在サイト名を含むので使わない
4. **Brand rules** — 第三者の製品名・ロゴ・ワードマークを主役にしない。アカウント表示名は中立な名前にする。実在サイトの記事本文・ロゴ・ファビコンを写さない。互換サービス名を説明文で挙げるのは可、画像内の看板にするのは不可。Store のガイドライン「スクリーンショットにロゴやマーケティング文言を追加しない」
5. **Fixed state** — ロケール、テーマ、選択中のアカウント・ビュー・記事、日時、タイムゾーン、サイズ、外部通信の遮断。値の正本はスクリプトの定数とし、文書には項目と理由だけを書く
6. **Capture procedure** — 2 つのコマンドと出力先。4173 番が使用中のときの対処
7. **Asset management** — コミット済みファイルを正とし、Partner Center へはコミット済みの PNG をアップロードする。試し撮りはコミットしない
8. **Post-capture checklist** — 第三者ブランドが主役になっていない、実在コンテンツが写っていない、個人情報がない、現行バージョンの UI である、3200 × 1800 である、正本 OS で撮った

## 決定 5: 影響範囲

| 対象 | 影響 | 対応 |
| --- | --- | --- |
| `src/__tests__/dev/dev-mock-data-demo-en.node.test.ts` | EN シードの名前変更で落ちるテストはない。124 行目は JA シードの目印なので影響なし | 規約のガードを 2 つ足す。(1) EN のアカウント表示名に第三者の製品名（`FreshRSS` など）を含まない (2) EN のフィードと記事の URL のホストが `example.com` かそのサブドメインだけ。どちらも、一度わざと落ちることを確かめてから採用する（`contract-test-policy.md`） |
| 同テストの preference シード部分 | `language: "en"` を確かめている既存テストがある | `theme: "system"` と `debug_agentation_visibility: "off"` を同じテストに足す |
| `src/__tests__/dev/scenarios/*`、`intent.node.test.ts` | シナリオ ID の追加 | 決定 2 のとおり |
| `src/__tests__/config/repo-contracts.node.test.ts` | valibot を使うテストファイルの許可一覧がある | 新しいテストファイルで valibot を使う場合だけ登録する |
| `src/__tests__/schemas/package-scripts.test.ts` | package.json の scripts と mise タスクの契約テスト | script 追加で落ちないかを確認する |
| knip | 新しいスクリプトファイル | package.json の script から参照されるので通常は検出される。`mise run quality:knip` で確認し、必要なら `knip.entry` に足す |
| 本番コード | なし | 変更は `src/dev/` とテスト、スクリプト、docs、画像だけ |

`"FreshRSS"` という文字列を含むテストは約 30 ファイルあるが、多くは `tests/helpers/fixtures.ts` の fixture を使っている。JA シードを変えないので、いずれも影響しない。

## 決定 6: 「Win / Mac で同一結果」の定義（要判断）

Issue の完了条件「Win / Mac のどちらで実行しても同一結果になる」は、画素単位では満たせない。

- `--font-sans` は OS 標準のフォントスタック（macOS は SF、Windows は Segoe UI Variable）で、同梱フォントがない
- 同じフォントでも、Chromium のアンチエイリアスとヒンティングは OS ごとに違う

撮影用にだけ Web フォントを同梱して画素を揃える案もあるが、採らない。実アプリが使わないフォントで撮ることになり、それ自体が「実物と違う見せ方」になるうえ、依存の追加も要る。

そこで次のように定義し直すことを提案する。

- **同一の状態・構図**: データ、選択状態、テーマ、日時、サイズ、外部通信を固定し、撮影前の DOM 検査で確かめる。これはどの OS でも同じになる
- **コミットする画像は正本 OS で撮る**: 書体の違いはこれで扱う

正本 OS の推奨は **Windows** とする。

| 案 | 長所 | 短所 |
| --- | --- | --- |
| Windows（推奨） | Store の利用者が見るのと同じ書体（Segoe UI）。10.1.1.3 の「実物どおりの見せ方」に最も近い | 日常の開発機（macOS）とは別の機械で撮る必要がある |
| macOS | 日常の開発機で撮れる。現行画像との連続性がある | Windows 版 Store の掲載画像が macOS の書体になる。前回の差し戻しで書体は指摘されていない |

この定義の変更は Issue の完了条件の解釈を変えるので、確定はユーザーが行い、Issue 本文へ反映する。

## 実装タスク

1 つの PR にまとめ、タスクごとにコミットを分ける。T1 から順に進める。

| # | 内容 | 主な変更 | 確認 |
| --- | --- | --- | --- |
| T1 | シードと preference の整備 | `mock-data-demo-en.ts`（表示名、Video フィードの URL）、`mock-state.ts`（`theme`、`debug_agentation_visibility`） | `dev-mock-data-demo-en.node.test.ts` のガード 2 つと preference の確認。`mise run check` |
| T2 | 撮影用シナリオ | `scenario-ids.ts`、`registry.ts`、`import-registry.ts`、`scenarios/types.ts`（`selectArticle` の `options`）、シナリオ本体 | runner / registry / intent のテスト。`mise run check` |
| T3 | 撮影スクリプト | `scripts/capture-store-screenshots.ts`、`package.json` の 2 script | macOS と Windows の両方で `capture:screenshots` を実行し、DOM 検査が通ること（シナリオで選んだ記事が起動時の自動着地に上書きされないことを含む）、4 ファイルが 3200 × 1800 で出ることを確かめる |
| T4 | 撮影規約ドキュメント | `docs/store-screenshots.md`、`docs/README.md`、`site/README.md` | markdownlint |
| T5 | 画像の差し替え | `docs/assets/`、`docs/assets/store/`、`site/assets/` | 正本 OS で `capture:screenshots:publish` を実行し、規約のチェックリストで目視確認する。`mise run ci` |

T3 の Windows 確認は、`.claude/rules/rust-cfg-split-policy.md` と同じ理由（開発機で通っても他 OS で通る保証にならない）で省略しない。

## 設計時の spike（2026-11-13、macOS）

src を変えずに、`VITE_DEV_MOCK_LOCALE=en` で vite を起動し（port 4199）、上の撮影条件（viewport、`deviceScaleFactor`、`colorScheme`、`locale`、`timezoneId`、`reducedMotion`、`page.clock.setFixedTime("2026-08-17T15:00:00Z")`、外部通信の遮断）で起動直後の画面を撮った。

| 確かめたこと | 結果 |
| --- | --- |
| 起動直後の状態 | 先頭アカウント（`FreshRSS`）、Unread スマートビュー（15 件）、先頭記事 `Remote work surveys show a plateau...` が自動で開いた状態に着地する。`h1` は表示名と記事タイトルの 2 つ |
| `art-en-3` の位置 | Unread の一覧で 4 件目に表示され、1600 × 900 の画面内に入る |
| `art-en-3` の記事ペイン | フィードの表示モードが既定（`inherit`）のままで本文が全段落出る。現行画像と違って本文はサンセリフ体で、メタ行に `example.com` が出る。セリフ体の選択肢は #494 で削除済みなので、現行画像は古い UI で撮られている。シナリオで表示モードは変えない |
| 時計の固定 | ページ内の `new Date()` が固定値を返し、記事の日付も固定値から計算される。表示の崩れや pageerror はない |
| テーマ | `colorScheme: "dark"` でも light のまま描画される。`theme` の既定値が `"light"` だからで、決定 2 の `theme: "system"` が必要 |
| Agentation | 表示される。`127.0.0.1:4747` へ通信しようとする。外部通信の遮断は「4173 番以外」を対象にする必要がある |
| 外部通信 | `https://www.google.com/s2/favicons` へのリクエストが出る（遮断した） |

T0 で残る確認は、撮影用シナリオで選んだ記事が、起動時の自動着地で上書きされないことだけである。シナリオを実装したあと、撮影スクリプトの DOM 検査（開いた記事のタイトル）で確かめる。

## Follow-ups

- `mise.toml` の `app:dev:browser:demo-en` を `env` テーブルで書き直し、Windows でも動くようにする（この Issue の必須範囲外）
- サイドバーの「Not synced yet」を、同期済みの表示にしたほうが掲載画像として自然かを検討する
