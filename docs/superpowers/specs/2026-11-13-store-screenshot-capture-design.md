# Store Screenshot Capture Design

Issue: [#657](https://github.com/jey3dayo/ultra-rss-reader/issues/657)（macOS 版）、[#660](https://github.com/jey3dayo/ultra-rss-reader/issues/660)（Windows 版）

## Summary

Microsoft Store 掲載用スクリーンショットを、規約に沿った撮影用シードから、コマンド 1 回で再生成できるようにする。アプリには macOS 版と Windows 版があるので、画像も両 OS で撮った 2 種類を用意する。

- アカウント表示名は、EN シードの `name` だけを中立な名前（`Personal`）に変える。実アプリでも表示名はユーザーが付けるものなので、実態と矛盾しない
- 撮影する状態は、撮影用 dev シナリオを 1 つ追加して固定する。既存の `open-feed-first-article` は構図が変わり、選ばれるフィードも安定しないので使わない
- テーマは、EN デモの preference を `theme: "system"` にしたうえで、Playwright の `colorScheme` で dark / light を切り替える
- 撮影スクリプトは Node から vite と Playwright を直接起動する。時計・タイムゾーン・外部通信を固定し、撮影後に DOM を検査してから画像を書き出す。実行中の OS を判定し、ファイル名の末尾に `-mac` / `-windows` を付ける
- Store 提出用は Windows で撮った PNG（Store の必須形式）、README と LP 用は JPG とする
- LP は OS ごとの画像を重ねて置き、2 種類そろうと macOS / Windows の切り替えが出る構造にする。macOS 版だけの間も 1 枚の画像として成立する
- #657 では macOS 版を撮ってコミットする。Windows 版は #660 で、Windows 上で撮ってコミットする

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
- 撮影状態（データ、選択中の記事、テーマ、日時、サイズ）をコードで固定し、macOS でも Windows でも同じ状態・構図の画像が出る
- `pnpm run capture:screenshots` 1 回で dark / light の 2 枚を生成する
- macOS 版と Windows 版の画像を、同じコマンドと同じ命名規則で撮り分ける
- 撮影規約を `docs/` に明文化する

## Non-goals

- Partner Center での画像差し替えと再提出。Windows 版の PNG が #660 でそろってから行う
- #657 の中での Windows 撮影（#660 で行う）
- JA シード（`src/dev/mock-data.ts`）の整備。撮影には使わない（決定 1 を参照）
- 4 枚以上の Store 用スクリーンショットの追加
- macOS 版と Windows 版の画素を一致させること。書体が OS ごとに違うのは実物どおりであり、それを見せるために 2 種類撮る（決定 6）

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

- `child_process.spawn(process.execPath, [<vite の bin>, ...])` で起動し、環境変数は `spawn` の `env` で渡す。シェルを経由しないので、macOS と Windows で同じように動く（決定 6「Windows での実行の担保」）
- `--strictPort` なので、指定したポートを他のサーバーが使っていたら起動に失敗する。そのときは「`--port` で空いているポートを指定する」旨のエラーを出して終える。環境変数の異なる既存サーバーを再利用すると別のシードで撮ってしまうので、再利用はしない
- ポートは既定で 4173 とし、`--port <番号>` で変えられるようにする。4173 番は別 worktree の `app:dev:browser` が使っていることがあり、他のセッションのサーバーは止めない（設計時にも、この開発機の 4173 番を別 worktree の vite が 11 月 4 日から使い続けていた）。外部通信の遮断と DOM 検査の URL は、実際に使うポートから組み立てる
- 撮影が終わったら、成功でも失敗でも vite のプロセスを止める

### 撮影条件

| 項目 | 値 | 目的 |
| --- | --- | --- |
| viewport | 1600 × 900 | 現行画像と同じ構図 |
| `deviceScaleFactor` | 2 | 出力 3200 × 1800（現行と同寸。Store の desktop 要件 1366 × 768 以上、最大 3840 × 2160 を満たす） |
| `colorScheme` | `"dark"` / `"light"` | テーマの切り替え（決定 2） |
| `locale` | `"en-US"` | 日付と数値の書式を固定 |
| `timezoneId` | `"UTC"` | OS のタイムゾーンに左右されない |
| 時計 | `page.clock.setFixedTime(<固定日時>)` を `page.goto` の前に呼ぶ | シードの相対日時と `TODAY` の区切りを固定。固定日時は UTC の `18:00`（日付は任意の固定値）にする。EN シードには当日 16:22 公開の記事（`art-en-5`）があるので、それより前の時刻では未来の日時の記事ができる。spike で使った `15:00Z` はこの条件を満たさない |
| `reducedMotion` | `"reduce"` | 遷移途中を撮らない |
| 外部通信 | `context.route` で `127.0.0.1:<使うポート>` 以外へのリクエストを中止する | ファビコンを頭文字のフォールバックに固定し、実在ロゴの混入とネットワーク依存をなくす |

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

ファイル名は `screenshot-reader-<theme>-<os>.<ext>` とする。`<theme>` は `light` / `dark`、`<os>` は `mac` / `windows`。`<os>` はスクリプトが `process.platform` から決める（`darwin` → `mac`、`win32` → `windows`）。どちらにも当たらない OS では、試し撮りは `-<process.platform>` を付けて書き出し、publish はエラーで終える。接尾辞のないファイル名は使わない。「接尾辞なし＝macOS」という暗黙の決まりは、Windows 側の作業者が推測できないからである。

| 形式 | 用途 | publish する OS | 出力先 |
| --- | --- | --- | --- |
| PNG | Store 提出（PNG 必須） | Windows だけ | `docs/assets/store/screenshot-reader-{light,dark}-windows.png` |
| JPG | LP（両 OS）、README（macOS 版だけ） | macOS と Windows | `docs/assets/screenshot-reader-{light,dark}-{mac,windows}.jpg` と `site/assets/` の同名ファイル |

- macOS の publish は JPG だけを書く。Store は Windows 版の画像を使うので、macOS 版の PNG はコミットしない
- 試し撮り（`tmp/` への出力）は、OS を問わず PNG と JPG の両方を書く。PNG を書くコードを #657 の中で macOS で一度動かしておき、#660 で初めて動く状態を避けるためである
- OS と出力パスの対応（どの OS で、どのモードのとき、どのファイルを書くか）は副作用のない関数に切り出し、単体テストで固定する

JPG の `quality` は、現行画像（各約 330 KB）と同程度のサイズになる値を実装時に決め、定数にする。書き出した画像は、ファイルヘッダーから幅と高さを読み、3200 × 1800 であることを確かめる。

`site/README.md` は `docs/assets/` を正本、`site/assets/` をそのコピーと定めているので、スクリプトは `docs/assets/` に書いた JPG を `site/assets/` へコピーする。

### 既存の JPG

現行の `screenshot-reader-{light,dark}.jpg`（`docs/assets/` と `site/assets/`）は、差し戻された `FreshRSS` の看板が写った画像である。#657 で削除し、参照を `-mac` の JPG に置き換える。残すと、LP のデプロイ後も旧 URL で公開され続ける。

| 参照元 | 変更後 |
| --- | --- |
| `README.md`、`README.ja.md` | `docs/assets/screenshot-reader-{light,dark}-mac.jpg`。README は今後も macOS 版だけを載せ、#660 では変えない |
| `site/index.html`、`site/ja/index.html` の `<picture>` | 決定 7 の構造に置き換える |
| 同 2 ページの `og:image`、`twitter:image` | `https://ultra-rss.jey3dayo.net/assets/screenshot-reader-light-mac.jpg` |
| `site/README.md` の Assets 節 | 新しいファイル名と、OS ごとの命名規則 |

`og:image` の URL が変わっても、SNS は次に共有されたときに取り直すだけで、壊れるものはない。Partner Center へは URL ではなくファイルをアップロードするので、Store 側にも影響しない。

### コマンド

| package.json script | 動作 |
| --- | --- |
| `capture:screenshots` | `node ./scripts/capture-store-screenshots.ts`。`tmp/screenshots/store/` に 4 ファイル（PNG / JPG × light / dark）を書き出す。試し撮り用 |
| `capture:screenshots:publish` | `node ./scripts/capture-store-screenshots.ts --publish`。上の出力先表のうち、実行中の OS の分を書き出す |

どちらのコマンドも macOS と Windows で同じ名前で使う。Issue の規約「試し撮りはコミットしない（`tmp/screenshots/` に出す）」に合わせ、既定の出力先は `tmp/` にする。

### macOS 版の画像が表すもの

撮影はブラウザモード（`app:dev:browser` と同じ vite）で行うので、Tauri のウィンドウ外観（macOS のオーバーレイタイトルバーと信号ボタンの余白）は写らない。macOS 版の画像は「macOS 上の Chromium で描いたアプリ画面」であり、書体は macOS のもの（SF）になる。Windows 版も同様に、書体は Windows のもの（Segoe UI Variable）になる。現行画像も同じ条件で撮っているので、今回の変更で悪くなる点ではない。撮影規約にもこの前提を書く。

## 決定 4: 撮影規約ドキュメント

ファイルは `docs/store-screenshots.md` とする。`docs/release-manual-verification.md` と同じ形式の frontmatter（`type: checklist` など）を付け、`docs/README.md` の索引と routing に 1 行ずつ足す。`site/README.md` の Assets 節からもリンクする。

章立て:

1. **Purpose** — 対象画像（`docs/assets/`、`site/assets/`、Store 提出用 PNG）と、この規約が必要になった経緯
2. **Policy background** — 10.1.1.3 の指摘内容（Microsoft の注記の原文）と Issue #657 の経緯。「FreshRSS という単語が禁止なのではなく、第三者の製品名が画面の主役になったことが問題」という整理
3. **Data rules** — 撮影は EN シードの撮影用状態だけで行う。実データ、実アカウント、実サーバーで撮らない。JA シードは実在サイト名を含むので使わない
4. **Brand rules** — 第三者の製品名・ロゴ・ワードマークを主役にしない。アカウント表示名は中立な名前にする。実在サイトの記事本文・ロゴ・ファビコンを写さない。互換サービス名を説明文で挙げるのは可、画像内の看板にするのは不可。Store のガイドライン「スクリーンショットにロゴやマーケティング文言を追加しない」
5. **Fixed state** — ロケール、テーマ、選択中のアカウント・ビュー・記事、日時、タイムゾーン、サイズ、外部通信の遮断。値の正本はスクリプトの定数とし、文書には項目と理由だけを書く。ブラウザモードで撮るのでウィンドウ外観は写らないこと（決定 3「macOS 版の画像が表すもの」）
6. **Platforms and file names** — macOS 版と Windows 版を撮り分ける理由（書体が OS ごとに違い、それが実物どおりの見え方であること）。命名規則 `screenshot-reader-<theme>-<os>.<ext>` と、OS ごとに書き出すファイルの一覧。Store には Windows 版の PNG を使い、README には macOS 版だけを載せること
7. **Capture procedure** — 2 つのコマンドと出力先。macOS と Windows それぞれの前提（Windows は Windows 11、Playwright の Chromium の導入）。4173 番が使用中のときは `--port` で別のポートを指定する
8. **Asset management** — コミット済みファイルを正とし、Partner Center へはコミット済みの PNG をアップロードする。試し撮りはコミットしない。LP に OS 別の画像を追加する手順（`data-platform` 付きの `<picture>` を足す。決定 7）
9. **Post-capture checklist** — 第三者ブランドが主役になっていない、実在コンテンツが写っていない、個人情報がない、現行バージョンの UI である、3200 × 1800 である、ファイル名の OS 接尾辞が撮影した OS と一致する

## 決定 5: 影響範囲

| 対象 | 影響 | 対応 |
| --- | --- | --- |
| `src/__tests__/dev/dev-mock-data-demo-en.node.test.ts` | EN シードの名前変更で落ちるテストはない。124 行目は JA シードの目印なので影響なし | 規約のガードを 2 つ足す。(1) EN のアカウント表示名に第三者の製品名（`FreshRSS` など）を含まない (2) EN のフィードと記事の URL のホストが `example.com` かそのサブドメインだけ。どちらも、一度わざと落ちることを確かめてから採用する（`contract-test-policy.md`） |
| 同テストの preference シード部分 | `language: "en"` を確かめている既存テストがある | `theme: "system"` と `debug_agentation_visibility: "off"` を同じテストに足す |
| `src/__tests__/dev/scenarios/*`、`intent.node.test.ts` | シナリオ ID の追加 | 決定 2 のとおり |
| `src/__tests__/config/repo-contracts.node.test.ts` | valibot を使うテストファイルの許可一覧がある | 新しいテストファイルで valibot を使う場合だけ登録する |
| `src/__tests__/schemas/package-scripts.test.ts` | package.json の scripts と mise タスクの契約テスト | script 追加で落ちないかを確認する |
| knip | 新しいスクリプトファイル | package.json の script から参照されるので通常は検出される。`mise run quality:knip` で確認し、必要なら `knip.entry` に足す |
| 出力パスの決定 | 新しい純粋関数 | OS（`darwin` / `win32` / それ以外）× モード（試し撮り / publish）ごとに、書き出すファイルの一覧を固定する単体テストを足す。publish が macOS で PNG を含まないこと、Windows で PNG を含むこと、それ以外の OS で拒否されることを含める |
| README、LP、`site/README.md` | 画像のファイル名が変わる | 決定 3「既存の JPG」のとおり置き換える |
| 本番コード | なし | 変更は `src/dev/` とテスト、スクリプト、docs、LP、画像だけ |

`"FreshRSS"` という文字列を含むテストは約 30 ファイルあるが、多くは `tests/helpers/fixtures.ts` の fixture を使っている。JA シードを変えないので、いずれも影響しない。

## 決定 6: macOS 版と Windows 版の運用

初版で提案した「コミットする画像を 1 つの OS で撮る」案は採らない（2026-11-13 のユーザー判断）。アプリには macOS 版と Windows 版があり、書体は OS ごとに違う（`--font-sans` は OS 標準のフォントスタックで、同梱フォントはない）。どちらの OS の画像も、その OS で動かしたときの実物どおりの見え方なので、両方を撮って用途ごとに使い分ける。

| 画像 | 撮る場所 | 使う場所 |
| --- | --- | --- |
| macOS 版 JPG | #657（macOS の開発機） | README、README.ja、LP |
| Windows 版 JPG | #660（Windows 11） | LP |
| Windows 版 PNG | #660（Windows 11） | Microsoft Store の掲載画像 |

「macOS と Windows で同一」とするのは、データ、選択状態、テーマ、日時、サイズ、通信といった状態と構図である。画素は一致しない。状態と構図はスクリプトの固定値と撮影前の DOM 検査で担保する。

### Windows での実行の担保

この worktree は macOS 上にあり、#657 では Windows でスクリプトを実行できない。そこで次の 3 つで担保し、実際の Windows 実行は #660 で行う。

1. 書き方で担保する。vite はシェルを経由せず `process.execPath` から `vite.js` を起動する。パスは `node:path` で組み立てる。環境変数は `spawn` の `env` で渡し、POSIX 形式の `VAR=value cmd` を使わない。プロセスの終了は `ChildProcess.kill()` で行い、`SIGTERM` などのシグナル名に頼らない
2. OS と出力パスの対応を単体テストで固定する（決定 5）。`process.platform` を引数で受け取る関数にして、macOS 上のテストで `win32` の場合も確かめる
3. #660 に「Windows 特有の理由で失敗したら、この範囲でスクリプトを直してよい」と明記する（#660 の「撮影スクリプトを直してよい範囲」）

`workflow_dispatch` だけで動く `windows-latest` のスモーク（試し撮りをして `tmp/` を artifact に上げる）を足せば、#657 の中で Windows 実行を確かめられる。ただし workflow の pin と CI 契約テストの更新が要り、GitHub Actions の Windows ランナーは Windows Server なので書体も Windows 11 と同じとは限らない。#660 の最初の試し撮りで同じことを確かめられるので、採らない。

### 担当と順序

| 段階 | 担当 | 内容 |
| --- | --- | --- |
| #657 | この worktree（macOS） | シード、シナリオ、スクリプト、撮影規約、LP の構造、macOS 版 JPG の撮影とコミット |
| #660 | ユーザーが Windows 上で Claude を動かして行う | Windows 版 JPG と PNG の撮影とコミット、LP への `<picture>` の追加 |
| 再提出 | ユーザー | #660 の PNG で Partner Center の画像を差し替えて再提出する。「認定へのメモ」に、FreshRSS は任意で接続する外部サーバーで本製品の一部ではない旨を英文で添える |

#660 は #657 の実装 PR が main にマージされてから着手する。

## 決定 7: LP の表示

LP（`site/index.html`、`site/ja/index.html`）では、macOS 版と Windows 版の画像を同じ枠に重ねて置き、2 種類そろったときだけ切り替えを出す。#657 の時点では macOS 版だけなので、切り替えは出ず、今と同じ 1 枚の画像に見える。表示の設計は emil-design-eng の観点で決めた。

### 構造

```html
<div class="screenshot-switcher" data-screenshot-switcher>
  <div class="screenshot-platforms" role="radiogroup" aria-label="Screenshot platform" hidden>
    <!-- JS が data-platform ごとにボタンを作る -->
  </div>
  <div class="screenshot-frame">
    <picture data-platform="mac" data-active>
      <source srcset="assets/screenshot-reader-dark-mac.jpg" media="(prefers-color-scheme: dark)" />
      <img src="assets/screenshot-reader-light-mac.jpg" width="1600" height="900" alt="Ultra RSS Reader on macOS: ..." />
    </picture>
    <!-- #660 で data-platform="windows" の <picture> をここに足す -->
  </div>
</div>
```

- 枠の中の `<picture>` は CSS Grid の同じセル（`grid-area: 1 / 1`）に重ねる。2 枚とも 1600 × 900 なので、重ねてもレイアウトはずれない
- 表示する 1 枚は `data-active` 属性で決める。属性のない `<picture>` は `opacity: 0` と `visibility: hidden` にする。`visibility: hidden` にした要素は支援技術からも隠れるので、`aria-hidden` は付けない
- `<picture>` ごとに `<source media="(prefers-color-scheme: dark)">` を持つ。テーマの切り替えは今と同じく OS の外観設定に従う
- 切り替えのボタンは HTML に書かず、JS が `data-platform` の数を数えて 2 つ以上のときだけ作り、`hidden` を外す。#660 で HTML に足すのは `<picture>` 1 つだけで済む
- JS が動かない環境では、`data-active` の付いた macOS 版だけが見える
- ボタンの表示名は `macOS` / `Windows`（JA ページも同じ）。`aria-label` は EN が `Screenshot platform`、JA が `スクリーンショットの OS`。`alt` は OS 名を含めて画像ごとに変える

### 初期選択と OS 判定

既存のスクリプトの `detectPlatform()`（ダウンロードボタンの出し分けに使っている）で、最初に選ぶ OS を決める。判定できない環境（Linux、モバイルなど）と、判定した OS の画像がないときは macOS を選ぶ。

既存の IIFE は、判定結果が `null` のとき `if (!platform) return;` で抜ける。切り替えの初期化をこの後ろに書くと、Linux やモバイルで切り替えが動かない。`detectPlatform()` を IIFE の外に出して共有し、切り替えは別の IIFE で初期化する。

初期選択は遷移を無効にしたまま適用し、次のフレームで `data-ready` を付けてから遷移を有効にする。読み込み直後に画像がフェードして入れ替わるのを防ぐためである。

### 操作とアクセシビリティ

- WAI-ARIA の radio group パターンにする。容器が `role="radiogroup"`、各ボタンが `role="radio"` と `aria-checked` を持つ。tabs パターンは各パネルに `role="tabpanel"` が要るが、`<picture>` には role を付けられず、包む要素を足すと #660 で追加するマークアップが増えるので採らない
- 選択中のボタンだけ `tabindex="0"` にし、左右の矢印キーで隣のボタンへ移ると同時に選択も切り替える（切り替えるのは画像 1 枚だけで、待ち時間がないため）
- 選んだ OS は保存しない。ページを開くたびに OS 判定から始める

### 見た目

- 切り替えは枠の上に中央寄せで置く、2 つのボタンからなる角丸の小さな区切りボタン（segmented control）。背景は `--surface-3`、枠線は `--border`。文字は 0.85rem 前後
- 選択中を示す下地（インジケーター）を 1 枚だけ置き、選択に合わせて横に動かす。2 つのボタンは同じ幅（`grid-template-columns: 1fr 1fr`）にし、インジケーターは `translateX(0)` と `translateX(100%)` の 2 位置だけを取る
- 選択中の文字は `--foreground`、非選択は不透明度を下げる
- LP の既存のトークン（`--surface-*`、`--border`、`--foreground`）だけを使い、新しい色は足さない

### モーション

切り替えは 1 回の訪問で数回押される程度で、頻度は低い。目的は、どの OS の画像に変わったかを知らせることと、急な入れ替わりを避けることである。

| 対象 | 動き | 値 |
| --- | --- | --- |
| インジケーター | `transform` の移動 | 200ms、`cubic-bezier(0.23, 1, 0.32, 1)` |
| ボタンの文字色 | `color` の変化 | 200ms、`ease` |
| ボタンを押したとき | `:active` で `transform: scale(0.97)` | 160ms、`ease-out` |
| ボタンの hover | 背景色の変化 | `@media (hover: hover) and (pointer: fine)` の中だけで有効にする |
| 画像 | `opacity` のクロスフェード | 150ms、`cubic-bezier(0.23, 1, 0.32, 1)`。隠す側は `visibility` を遷移の終わりに切り替える（`transition: opacity 150ms ..., visibility 0s linear 150ms`） |

- `transition: all` は使わず、動かすプロパティを列挙する。キーフレームではなく transition にする。連続して押されても途中から向きを変えられるからである
- 2 枚の画像はレイアウトが同じで書体だけが違うので、クロスフェードの途中で文字が二重に見えることがある。実装後に遷移を 5 倍に伸ばして確かめ、二重に見えたら隠れる側に `filter: blur(2px)` を足す。それでも気になるときは、画像だけ遷移なしで切り替える
- `prefers-reduced-motion: reduce` では、インジケーターの移動とボタンの縮小をなくし、画像の opacity の変化だけを残す。LP の既存の書き方（`@media (prefers-reduced-motion: no-preference)` の中で遷移を有効にする）に合わせ、`transform` の遷移はこのメディアクエリの中にだけ書く

### 読み込み

`<picture>` は現在のテーマに合う画像を 1 枚ずつ読むので、Windows 版を足すと読み込みは JPG 1 枚分（約 350 KB）増える。非選択の画像も先に読んでおけば、切り替えた瞬間に表示できる。増える量は許容し、遅延読み込みはしない。

### #657 での確かめ方

#657 の時点では Windows 版の画像がなく、切り替えが表示されない。そこで、`tmp/` に macOS 版の画像の複製を置き、`data-platform="windows"` の `<picture>` を一時的に足したページで確かめる。複製と一時的な変更はコミットしない。

- 切り替えが表示され、クリックと矢印キーで選択が変わる
- 初期選択が OS 判定に従う（macOS のブラウザでは macOS）
- light / dark の両方で、インジケーターと文字の色が読める
- 5 倍に伸ばした遷移で、インジケーターの動きと画像の切り替えに不自然さがない
- `prefers-reduced-motion: reduce` で、移動がなくなり opacity だけが変わる
- 画像を 1 つに戻すと、切り替えが消え、今と同じ 1 枚の表示になる

## 実装タスク

#657 の中で、1 つの PR にまとめ、タスクごとにコミットを分ける。T1 から順に進める。

| # | 内容 | 主な変更 | 確認 |
| --- | --- | --- | --- |
| T1 | シードと preference の整備 | `mock-data-demo-en.ts`（表示名、Video フィードの URL）、`mock-state.ts`（`theme`、`debug_agentation_visibility`） | `dev-mock-data-demo-en.node.test.ts` のガード 2 つと preference の確認。`mise run check` |
| T2 | 撮影用シナリオ | `scenario-ids.ts`、`registry.ts`、`import-registry.ts`、`scenarios/types.ts`（`selectArticle` の `options`）、シナリオ本体 | runner / registry / intent のテスト。`mise run check` |
| T3 | 撮影スクリプト | `scripts/capture-store-screenshots.ts`、`package.json` の 2 script | 出力パスの単体テスト（`win32` を含む）。macOS で `capture:screenshots` を実行し、DOM 検査が通ること（シナリオで選んだ記事が起動時の自動着地に上書きされないことを含む）、4 ファイルが 3200 × 1800 で `-mac` 付きで出ることを確かめる |
| T4 | 撮影規約ドキュメント | `docs/store-screenshots.md`、`docs/README.md`、`site/README.md` | markdownlint |
| T5 | macOS 版の画像 | `capture:screenshots:publish` の出力、旧 `screenshot-reader-{light,dark}.jpg` の削除、`README.md`、`README.ja.md`、LP 2 ページの画像パスと `og:image`、`twitter:image` | 撮影規約のチェックリストで目視確認する。旧ファイル名の参照が残っていないことを検索で確かめる |
| T6 | LP の構造 | `site/index.html`、`site/ja/index.html`（決定 7 の構造） | 決定 7「#657 での確かめ方」。`ui-design-review-loop.md` の観点ごとの確認。最後に `mise run ci` |

初版からの差分は次のとおり。

- T3: 確認から Windows での実行を外し、出力パスの単体テストを足した。Windows での実行は #660 で行う
- T5（初版の T5）: 撮るのは macOS 版だけにした。Store 用の PNG はコミットしない。旧 JPG を削除し、README と LP の参照を置き換える
- T6（新規）: LP を OS 別の画像を重ねる構造にする
- Windows 版の撮影、LP への Windows 版 `<picture>` の追加、Store 用 PNG のコミットは #660 に移した

## 設計時の spike（2026-11-13、macOS）

src を変えずに、`VITE_DEV_MOCK_LOCALE=en` で vite を起動し（port 4199）、上の撮影条件（viewport、`deviceScaleFactor`、`colorScheme`、`locale`、`timezoneId`、`reducedMotion`、`page.clock.setFixedTime("2026-08-17T15:00:00Z")`、外部通信の遮断）で起動直後の画面を撮った。

| 確かめたこと | 結果 |
| --- | --- |
| 起動直後の状態 | 先頭アカウント（`FreshRSS`）、Unread スマートビュー（15 件）、先頭記事 `Remote work surveys show a plateau...` が自動で開いた状態に着地する。`h1` は表示名と記事タイトルの 2 つ |
| `art-en-3` の位置 | Unread の一覧で 4 件目に表示され、1600 × 900 の画面内に入る |
| `art-en-3` の記事ペイン | フィードの表示モードが既定（`inherit`）のままで本文が全段落出る。現行画像と違って本文はサンセリフ体で、メタ行に `example.com` が出る。セリフ体の選択肢は #494 で削除済みなので、現行画像は古い UI で撮られている。シナリオで表示モードは変えない |
| 時計の固定 | ページ内の `new Date()` が固定値を返し、記事の日付も固定値から計算される。表示の崩れや pageerror はない |
| テーマ | `colorScheme: "dark"` でも light のまま描画される。`theme` の既定値が `"light"` だからで、決定 2 の `theme: "system"` が必要 |
| Agentation | 表示される。`127.0.0.1:4747` へ通信しようとする。外部通信の遮断は「撮影に使うポート以外」を対象にする必要がある |
| 外部通信 | `https://www.google.com/s2/favicons` へのリクエストが出る（遮断した） |

残る確認は、撮影用シナリオで選んだ記事が、起動時の自動着地で上書きされないことだけである。シナリオを実装したあと、T3 で撮影スクリプトの DOM 検査（開いた記事のタイトル）によって確かめる。

## Follow-ups

- `mise.toml` の `app:dev:browser:demo-en` を `env` テーブルで書き直し、Windows でも動くようにする（この Issue の必須範囲外）
- サイドバーの「Not synced yet」を、同期済みの表示にしたほうが掲載画像として自然かを検討する
