# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/)

## [Unreleased]

## [0.53.15] - 2026-07-03

### Bug Fixes

- Toolchain compatibility: align npm-check-updates version with contract specification.

## [0.53.14] - 2026-07-03

### Features

- macOS の埋め込みブラウザで、j/k/m/s/b/r/h/l などアプリのキーボードショートカット全種を子 webview フォーカス中でも使えるようにした。従来は Escape のみ対応していた。

### Bug Fixes

- macOS の埋め込みブラウザで、マウスの戻る/進むボタンによるナビゲーションが動作しない問題を修正した。履歴が尽きた状態で戻るを押すと、閉じるボタンと同様に overlay を閉じる。
- 無効化された記事フィルターボタンにカーソルを合わせた際、既定のカーソル表示になるよう修正した。

### Maintenance

- apm.yml のインデントを整形し、未使用の chrome-devtools MCP エントリを削除した。

## [0.53.13] - 2026-07-02

### Features

- 設定画面の「バックアップと復元」に「今すぐバックアップ」を追加し、マイグレーション以外のタイミングでも手動でデータベースをバックアップできるようにした。

## [0.53.12] - 2026-07-02

### Features

- フィード単位・フォルダ単位で「すべて既読にする」確認文言をスコープに応じて表示し、対象がない場合はボタンとフィルタートグルを無効化するようにした。

### Maintenance

- 埋め込みブラウザの webview クローズ処理を専用ヘルパーへ抽出した。リーダーモードへの復帰はネイティブクローズの完了を待たずに即時反映する既存の挙動を維持している。
- リリースコマンドでビルド完了後に GitHub Release を自動公開するよう整理した。
- リリース年齢ポリシーの範囲内で minor/patch 依存関係を更新した。

## [0.53.11] - 2026-07-02

### Bug Fixes

- フォルダ選択時に記事を開いて自動既読になった際、記事一覧の未読アイコンも既読表示へ更新されるようにした（フィード選択時と挙動を統一）。

### Maintenance

- Reader のネイティブ診断値をレンダー時にリセットするよう整理した。
- Reader のレイアウト診断値をレンダー時にリセットするよう整理した。
- レンダー時に評価する値を安定化し、不要な再計算を減らした。
- 非推奨の Zod v4 object API を新 API へ移行した。
- `run` と同一の冗長な mise `run_windows` オーバーライドを削除した。

## [0.53.10] - 2026-07-02

### Maintenance

- mise の Windows タスクを pwsh インラインシェル方式へ移行し、`run_windows` を PowerShell 構文に統一した。
- 整合性を守らない npm-check-updates のバージョン固定 assertion を契約テストから削除した。

## [0.53.9] - 2026-07-02

### Bug Fixes

- 既読更新時にフォルダ単位の記事一覧キャッシュも対象に含め、未読フィルタ表示との整合を取れるようにした。

### Maintenance

- npm-check-updates を 22.2.9 に更新した。

## [0.53.8] - 2026-07-01

### Bug Fixes

- Reader の classic 選択スタイルで左ボーダー領域を常時確保し、選択切り替え時に記事タイトルの折り返しや行幅が変わらないようにした。
- Reader のサイドバー、記事一覧、本文ペインを遅延読み込みしつつ、ペイン切り替え時の状態と focus 復帰が崩れにくいようにした。

### Maintenance

- Storybook の記事一覧シナリオを整え、classic 選択スタイルの同一文言で選択/非選択の回帰確認をしやすくした。

## [0.53.7] - 2026-06-30

### Features

- 開発者向け設定を追加し、Web Preview の検証 URL や開発用 overlay の表示を設定画面から扱えるようにした。
- 共有のキーボードショートカット表示部品を追加し、ショートカット表記を UI 全体で揃えやすくした。

### Bug Fixes

- 設定から入力した Web Preview URL が保存済みの初期値ではなく、入力した URL で開くようにした。
- 設定から開いた Web Preview が記事ペインの Web Preview と同じ右ペイン layout を使うようにし、表示位置と chrome の見え方を揃えた。
- タグ設定の補足文を外し、設定画面の情報量を整理した。
- preference resolver を zod schema から分離し、起動時 bundle に余計な依存が入りにくいようにした。

### Maintenance

- repo-local MCP 設定を追加し、Tauri と Chrome DevTools の開発支援ツールをこのリポジトリ向けに扱えるようにした。

## [0.53.6] - 2026-06-30

### Bug Fixes

- Reader の記事一覧で未読マーカー、選択インジケーター、日付ヘッダー、スクロールバーの見た目を整理し、キーボード移動やスクロール時に現在位置を追いやすいようにした。

## [0.53.5] - 2026-06-30

### Features

- Reader の購読フィード切り替えに軽い選択マーカーと記事一覧の入れ替え motion を追加し、フィード移動時の状態変化が分かりやすくなるようにした。

### Maintenance

- Release 前にローカル preflight を通してから tag push する手順を追加し、version parity、release build contamination、format、型、unit CI の確認漏れを抑えるようにした。

## [0.53.4] - 2026-06-30

### Bug Fixes

- Reader の通常記事表示で本文領域が内部スクロールできなくなる問題を修正し、Web プレビュー OFF でも長い記事を最後まで読めるようにした。
- Reader のサイドバー、記事一覧、本文ペインの高さ境界とタイトルバー余白を揃え、コンパクト表示や小さいウィンドウでも操作領域がずれにくいようにした。

### Documentation

- Reader ナビゲーションレールとタイトルバー余白の設計メモを追加し、今後の UI 調整で同じ境界を確認しやすくした。

## [0.53.3] - 2026-06-29

### Bug Fixes

- Reader の Web プレビューを 2 ペイン構成で安定させ、Tauri WebView の表示位置、上部コントロール、macOS のタイトルバー領域がずれにくいようにした。
- Web プレビュー中の未読フッターや overlay surface の重なりを整理し、外部サイトのモーダルや reload 後でも操作を戻しやすいようにした。
- フィード編集ダイアログ、選択 summary、サイドバーの右端レール、読み取り専用フィールドのコピー操作を揃え、Reader 周辺の余白と操作位置のずれを抑えた。
- production bundle で dev intent が混入しないようにし、開発用 Agentation toolbar がダイアログ操作を邪魔しにくいようにした。

### Documentation

- PR テンプレートと主要 docs に、release、startup bundle、native/WebView まわりの確認観点と metadata を追加した。

### Maintenance

- フィード編集ダイアログと menu primitive の整理、NHK mock article 更新、WebView cleanup/dev scenario coverage を追加した。
- Release CI の jsdom preflight が Reader の現行 `main-stage` scope contract を検証するようにし、`v0.53.2` の preflight 失敗を修正した。

## [0.53.2] - 2026-06-29

### Bug Fixes

- Reader の Web プレビューを 2 ペイン構成で安定させ、Tauri WebView の表示位置、上部コントロール、macOS のタイトルバー領域がずれにくいようにした。
- Web プレビュー中の未読フッターや overlay surface の重なりを整理し、外部サイトのモーダルや reload 後でも操作を戻しやすいようにした。
- フィード編集ダイアログ、選択 summary、サイドバーの右端レール、読み取り専用フィールドのコピー操作を揃え、Reader 周辺の余白と操作位置のずれを抑えた。
- production bundle で dev intent が混入しないようにし、開発用 Agentation toolbar がダイアログ操作を邪魔しにくいようにした。

### Documentation

- PR テンプレートと主要 docs に、release、startup bundle、native/WebView まわりの確認観点と metadata を追加した。

### Maintenance

- フィード編集ダイアログと menu primitive の整理、NHK mock article 更新、WebView cleanup/dev scenario coverage を追加した。

## [0.53.1] - 2026-06-29

### Bug Fixes

- Reader のコンテキストメニューとアカウント切り替えメニューを不透明な popup surface に揃え、背後の記事本文が透けて文字がにじんで見える問題を抑えた。

## [0.53.0] - 2026-06-29

### Bug Fixes

- Reader サイドバーの数字列、購読セクションの矢印、フィード/フォルダ行の余白を揃え、件数表示がガタついて見えにくいようにした。
- Reader の記事グループ見出しを少し薄くし、一覧の情報密度を上げた。
- 記事の未読/既読、スター、フッター絞り込みの操作フィードバックを整理し、過剰な toast を抑えながら状態変化が伝わるようにした。
- 設定画面のコントロール、タグ編集ダイアログ、フォーム文字組み、モーダルヘッダーを揃え、操作部品の密度と見た目を整えた。
- アプリアイコンの元画像と生成 asset の inset を調整し、表示時の余白と欠けを抑えた。
- 起動直後のアップデート確認を遅らせ、初期表示の体感を妨げにくいようにした。

### Maintenance

- Node.js とフロントエンド依存を更新し、現行ツールチェーンに追従した。

## [0.52.2] - 2026-06-28

### Bug Fixes

- フィード追加・編集ダイアログのフォーム構成を低ワイヤーな設定フォームに揃え、URL入力、検出ボタン、フォルダ選択のレールと余白がずれにくいようにした。
- Reader のプレビュー、概要、未読コンテキスト表示を整理し、空状態や選択状態の画面密度と読み取りやすさを改善した。
- Webプレビューのセッション表示モードを保持し、プレビュー操作中に表示状態が意図せず戻りにくいようにした。
- タグ色編集の永続化を安定させ、編集後の色が保持されるようにした。

### Maintenance

- mise task を直接実行する運用へ寄せ、RTK wrapper 依存を外して品質チェックとリリース前確認を扱いやすくした。

## [0.52.1] - 2026-06-28

### Bug Fixes

- Webプレビュー時の wide layout を記事一覧とコンテンツの2ペインに収め、フォルダ/サイドバーの残り筋や hit-test が記事一覧操作を邪魔しないようにした。
- Webプレビューの content pane 配置、bounds、overlay surface の契約を整理し、外部ブラウザ確認や Tauri WebView の表示位置がずれにくいようにした。
- 空の選択状態からフィードを開いたとき、最初の記事へ自然に着地するようにした。

### Maintenance

- Webプレビューの wide layout、content pane geometry、overlay surface の回帰テストを追加・更新した。

## [0.52.0] - 2026-06-27

### Bug Fixes

- command palette の `cmdk` 依存を design-system barrel から分離し、初期 bundle に command primitive が混入しにくい構成へ整理した。
- Tauri 外の production preview でも browser mock IPC を有効化し、外部ブラウザでの preview 動作確認時に unread badge 更新の IPC error が出ないようにした。

### Maintenance

- command primitive の直接 import 例外と production Tauri runtime の mock bootstrap 契約をテストで固定した。

## [0.51.3] - 2026-06-26

### Features

- Reader のフィード行コンテキストメニューから購読管理へ進める導線を追加した。
- 開発時に Agentation overlay の表示設定と APM / MCP metadata を扱えるようにした。

### Bug Fixes

- Reader の passive summary card を semantic tone と low-wire surface に揃え、未読・スター・最近見た記事・フィード summary の表示崩れと余白過多を抑えた。
- 設定画面のデバッグページや compact select の折り返しを調整し、日本語ラベルでも窮屈に見えにくくした。
- 購読管理画面の詳細 surface、見直し候補 chip、管理アクションの密度を揃え、一覧・詳細・summary の視覚的なずれを減らした。
- 開発用 seed と app dev task を更新し、購読レビューサンプルとローカル起動タスクを扱いやすくした。

### Maintenance

- APM metadata と Agentation MCP 設定を追加し、root YAML lint contract を更新した。

## [0.51.2] - 2026-06-25

### Maintenance

- CI release preflight の jsdom テスト期待値を、Reader の選択行と購読詳細パネルの現行 UI class contract に揃えた。

## [0.51.1] - 2026-06-25

### Features

- 開発用 Agentation toolbar を追加し、UI 調整時の視覚フィードバックを扱いやすくした。

### Bug Fixes

- Reader サイドバーのフォルダ行で chevron を独立操作ではなく行全体の展開状態表示として扱い、タグ行や記事選択状態の密度も揃えた。
- 購読管理画面の一覧・詳細・サマリーの余白とレビュー文言を整理し、低密度の画面構成を読み取りやすくした。

## [0.51.0] - 2026-06-25

### Features

- ローカルアカウントごとに同期フォルダを設定し、購読フィード、フォルダ、既読 / スター、タグ、記事タグ、ミュートキーワードを専用 operation ファイルで読み書きできるようにした。
- 同期ファイルの parse error、schema version 不一致、partial temp file、conflicted copy を検出し、ローカル DB を黙って壊さずに import を止めるようにした。

### Maintenance

- knip と portless を更新し、開発・品質チェックまわりの依存を現行版へ揃えた。

## [0.50.1] - 2026-06-25

### Bug Fixes

- アップデートのダウンロードが 100% に達した後の toast を「インストール準備中…」へ切り替え、処理継続中であることを分かりやすくした。

## [0.50.0] - 2026-06-25

### Features

- ローカルアカウント同期の基盤と投影処理を追加し、ローカル購読データの同期状態を扱えるようにした。
- 設定プロファイルの書き出しで保存ダイアログを使えるようにし、出力先を選びやすくした。

### Bug Fixes

- Reader の低密度ワイヤー、フォルダツリーのインデント、フィルタートグル、ゴーストボタン、コントロール角丸を揃え、購読一覧と記事操作の視覚的なずれを抑えた。
- 設定画面のヘッダー、カード密度、説明行、データ管理文言、長いラベルやコマンド値の折り返しを再構成し、狭いモーダル幅でも操作部品が重なりにくいようにした。
- updater 設定がある環境で手動アップデート確認を実行できるようにした。
- 購読詳細パネルの low-wire surface を適用し、設定・Reader と近い見た目に揃えた。

### Documentation

- 設定画面の説明行と inset filter controls の設計ガイドを追記した。

### Maintenance

- option shape 型を整理し、重複した型定義を減らした。
- アプリアイコン assets と article filter footer のテスト契約を更新した。
- 購読ツリー breakdown UI と article filter toggle の ghost style を調整した。

## [0.49.3] - 2026-06-24

### Maintenance

- フッターのフィルタートグルの shadow token テストを実装済みの UI 契約に揃え、release preflight の jsdom チェックを安定させた。

## [0.49.2] - 2026-06-24

### Fixed

- 購読一覧のツリー表現、見直し候補の判定文言、手動アップデートメニューの表示条件を調整し、レビュー指摘後の UI と契約を安定させた。

## [0.49.1] - 2026-06-24

### Maintenance

- フィードツリー密度のテスト期待値を実装済みの compact / normal tokens に揃え、CI の jsdom 契約を安定させた

## [0.49.0] - 2026-06-24

### Bug Fixes

- 設定画面のフォーム行、ナビゲーション密度、削除アイコン、データ管理ページの折り返しを整え、狭い設定カードでも操作部品が重ならないようにした
- 購読ツリーの密度と購読管理サマリーの選択表示を調整し、左ペインと見直しカードの視覚ノイズを抑えた

### Documentation

- 設定画面の行レイアウト、削除アイコン、ナビゲーション密度の design guidance を更新した

## [0.48.2] - 2026-06-24

### Bug Fixes

- Toast の表示密度を抑え、通知が画面上で過度に目立たないようにした

### Maintenance

- pnpm とフロントエンド品質ツール群を更新し、package / lockfile / contract test の固定値を現行バージョンへ揃えた

## [0.48.1] - 2026-06-24

### Bug Fixes

- モバイル設定モーダルのナビゲーション領域を広げ、アカウント rail が狭幅で見切れにくいようにした

### Maintenance

- モバイル記事ツールバーの shrinkable label 契約に Storybook density / component tests を追従させ、release preflight を通るようにした

## [0.48.0] - 2026-06-24

### Bug Fixes

- Reader のモバイル記事ツールバー、設定モーダル、設定行、購読一覧ヘッダーの狭幅・高密度レイアウトで横 overflow が出ないようにした

## [0.47.2] - 2026-06-24

### Bug Fixes

- Reader、設定、購読管理画面の余白・密度・操作面を整え、主要フローの見た目とタッチターゲットを安定させた
- 購読管理サマリーの表示文言と操作状態をローカライズし、一覧と詳細ペインのレビュー判断を読み取りやすくした
- フィード lifecycle 操作をリモート provider 経由でも扱えるようにし、購読管理まわりの同期境界を改善した

## [0.47.1] - 2026-06-22

### Bug Fixes

- テストとブラウザイベント周辺の型契約を厳密化し、UI/runtime 境界の型安全性を高めた

### Documentation

- `@/design-system` を UI 公開 API として扱う方針を `DESIGN_REVIEW.md` に明文化した

### Maintenance

- UI 部品の利用経路を `@/design-system` 経由へ整理し、Base UI / shared component の実装所有境界を固定した
- WSL 向け静的チェック task を追加・整理し、Windows 側でも format / lint の確認を走らせやすくした
- EditorConfig を追加し、エディタ間の基本フォーマット設定を揃えた

## [0.47.0] - 2026-06-19

### Features

- FreshRSS アカウントでもフィード追加ダイアログから購読を追加できるようにした

### Bug Fixes

- フィード追加ダイアログを設定画面に合わせた簡潔な行レイアウトへ整理し、ラベル折り返しや過剰なセクション表示を抑えた
- Focus Debug HUD を遅延読み込みにし、通常起動時の初期読み込み負荷を減らした
- アカウント別の記事取得を最適化し、SQLite クエリの余計な走査を減らした

### Maintenance

- package / pnpm / Rust toolchain の lockfile を更新した
- Vitest のキャッシュ削除テストと GitHub Actions の pnpm cache setup を調整し、CI の安定性を上げた
- app shell の import 形式を formatter に合わせて整えた

## [0.46.1] - 2026-06-18

### Features

- Storybook に Debug HUD の状態を確認できる story を追加し、開発時の表示確認をしやすくした

### Bug Fixes

- Tauri の single-instance 制御を復旧し、アプリを複数起動しようとしたときに既存ウィンドウへ戻るようにした

### Maintenance

- JS / Rust toolchain と lockfile を更新し、Biome / React Doctor / Knip の品質 baseline を現行バージョンへ揃えた
- Reader の記事余白に関するテスト期待値を実装に合わせ、UI の padding 契約を固定した
- jsdom の日時依存テストを固定時刻で安定化し、subscriptions index 周辺の高速テストを再現しやすくした
- GitHub Actions の pnpm setup と mise toolchain を調整し、yamllint を uv 経由で解決して CI の toolchain setup を安定させた

## [0.46.0] - 2026-06-13

### Documentation

- リリースに不具合が出た場合の fix-forward 方針と、最終手段の手動ダウングレード手順(現行 DB 退避・pre-migration バックアップ復元・stale な WAL/SHM の処理)を incident runbook に追記した
- updater 署名鍵の運用(鍵ローテーションの安全な順序・鍵喪失/漏洩時の対応・段階配信が無いことの accepted-risk)をリリースワークフローのルールに明文化した

### Maintenance

- FreshRSS / GReader 同期の競合解決規則(ローカル pending mutation 優先、再適用の冪等性、再同期の収束)を contract test として固定した
- jsdom テストのファイル間分離を強化し(グローバルスタブと document インラインスタイルの自動復元)、順序依存で不安定だった購読一覧テストを quarantine ポリシーに沿って一時隔離した

## [0.45.1] - 2026-06-11

### Maintenance

- FreshRSS / GReader 同期で大量の記事状態を適用するときの判定処理を高速化し、既に同じ既読・スター状態の行は不要な更新を避けるようにした
- ローカルフィードや provider-managed feed の同期修復で、ミュート自動既読の再評価を対象 feed に限定し、記事が更新されない同期でもアカウント全体を繰り返し走査しないようにした

## [0.45.0] - 2026-06-10

### Features

- 記事や未読がなくサイドバーから見えない購読でも、Reader の空状態や詳細パネルから購読一覧の該当項目を開き、編集や削除判断に進めるようにした

### Bug Fixes

- 開発環境でランタイム用のテーマ別アイコン画像が存在しない場合、アイコン切り替え失敗を不要な診断エラーとして出さないようにした

### Maintenance

- Windows の Tauri dev タスクを薄い `node ...` 呼び出しに戻し、子プロセスの PATH 正規化で Node と project-local executable の解決を安定させた

## [0.44.0] - 2026-06-08

### Maintenance

- 設定、アカウントの骨格、タグ、ミュートキーワードを JSON の設定プロファイルとして書き出し・読み込みできるようにした。パスワードや記事データは含めず、Windows / macOS 間で再利用しやすい merge-only import にした
- Storybook explorer のカテゴリ構成と command palette history storage の責務境界を整理し、UI 開発と履歴管理まわりの保守性を上げた

## [0.43.12] - 2026-06-08

### Bug Fixes

- 同期中は updater action を無効化し、同期処理と更新操作が重ならないようにした

### Maintenance

- Reader 検索を FTS fast path 優先にし、通常の検索で LIKE fallback を常時実行しないようにして記事検索の負荷を減らした
- 記事一覧向けの SQLite ordered index を追加し、feed ごとの記事一覧取得を安定して index で処理できるようにした
- browser geometry guard、Tauri API import、toast placement の責務境界を整理し、React Doctor 指摘に沿って UI / runtime 周辺の保守性を上げた
- JS toolchain、Tauri lockfile、capability schema を更新した

## [0.43.11] - 2026-06-02

### Bug Fixes

- release asset recovery workflow の認証、main branch dispatch、既存 asset 検証を見直し、release recovery が安全に再実行できるようにした
- Rust cache 保存失敗で release workflow が止まりにくいようにした

### Maintenance

- Reader の記事一覧 payload と SQLite list query を軽量化し、一覧表示時に記事本文を不要に読み出さないようにした
- Reader shell の scroll area を native scroll に置き換え、初期 bundle に入る Base UI runtime を減らした

## [0.43.10] - 2026-05-27

### Bug Fixes

- アカウント一覧の読み込み後に選択中アカウントへ focus を戻し、キーボード操作でアカウントペインへ移動したときの focus を安定させた

### Maintenance

- 起動時に読み込む翻訳 namespace を reader 初期表示に必要な範囲へ絞り、settings / subscriptions の翻訳を必要時に読み込むようにした
- 時刻表示と Tauri window API の vendor import を軽量化し、startup bundle に入る不要な依存を減らした

## [0.43.9] - 2026-05-26

### Bug Fixes

- Smart View から unread folder を開いたとき、未読フォルダが自動展開されるようにした

### Documentation

- boundary ownership rule を追加し、refactor 時の責務境界と移動先判断を整理した

### Maintenance

- release skill の手順を phase ごとの参照ファイルに分割し、関連 contract test を追加した
- dev / Storybook helper と mock runtime の責務境界を整理した
- GReader origin 由来の未使用 title field を削除した
- tag query / mutation の Result 処理を React Query adapter 境界へ寄せた
- Windows dispatch の env schema 型を明示し、型アサーションを減らした
- boundary rule 追加に合わせて repo contract の許可リストを更新した

## [0.43.8] - 2026-05-25

### Bug Fixes

- Reader の context menu が reader chrome の下に隠れないようにした
- 設定画面の switch ON 色をアイコンの暖色アクセントに合わせた warm bronze に調整した

### Maintenance

- React Doctor 指摘を解消し、component / helper / storybook specimen の責務境界を整理した
- Settings action hook と Reader toolbar の非 component export を分離した
- UI store の型 surface を整理した
- 不要になった observer mock alias を削除した

## [0.43.7] - 2026-05-24

### Bug Fixes

- 設定画面のトグルを、ON は primary 色と右つまみ、OFF は neutral 色と左つまみで判別できるようにした
- 空の Reader 表示と toolbar 周辺の見た目を整え、記事がない状態でも操作面が崩れにくいようにした

### Maintenance

- アプリ同期結果の処理を分離し、同期フローの責務境界を整理した
- 空記事 toolbar の期待値テストを現在の表示仕様に合わせた

### Documentation

- agent 向けの source of truth table を追加し、参照すべきプロジェクト文書を整理した

## [0.43.6] - 2026-05-23

### Bug Fixes

- ポップアップの重なり順を共通化し、Reader / Settings 周辺の表示順が崩れにくいようにした

### Maintenance

- UI commonization と similarity triage の完了済み TODO を整理し、active backlog を空にした
- pnpm 11 と周辺 frontend toolchain へ更新し、依存 lockfile と toolchain contract を揃えた
- Reader / Settings / Subscriptions 周辺の feature-local 型を owner module へ寄せ、残す type surface を contract で明示した
- component result handling と settings / subscriptions の共通 UI 部品を整理し、重複した type surface と helper 境界を縮小した
- FreshRSS pending mutation recovery の契約テストを追加し、古い remote snapshot が local intent を上書きしないことを確認できるようにした
- Inoreader の add-account entry を削除し、現在サポートする account provider 一覧を整理した

### Documentation

- remote content privacy policy と result boundary rule を記録した

## [0.43.5] - 2026-05-21

### Bug Fixes

- 記事一覧の並び替えで公開日時の解析を記事ごとに 1 回へ抑え、大量の記事を表示するときの CPU 負荷を減らした

## [0.43.4] - 2026-05-19

### Features

- 設定画面のアカウント詳細から OPML を import できるようにした

### Bug Fixes

- Web Preview の WebView に focus がある状態でも `Escape` で閉じられるようにした
- Web Preview を閉じた直後に `j` / `k` で次/前の記事へ移動できるように、記事一覧へ focus を戻すようにした
- Web Preview を明示的に閉じたあと、記事移動で一時的な WebView 表示状態が復活しないようにした
- Reader の記事本文とメディア幅を分離し、本文レイアウトが不要に広がらないようにした
- 記事一覧のスクロールバー領域とテキスト選択挙動を安定させた

### Documentation

- Reader の focus return contract と native dev app の検証手順を文書化した

## [0.43.3] - 2026-05-18

### Bug Fixes

- Web Preview の embedded WebView がウィンドウ端・角のリサイズに追従するようにした
- ウィンドウを極小サイズへ縮めても embedded browser が途切れないように、main window の最小サイズを維持するようにした
- production bundle に dev mock が混入しないようにして、本番ビルドの不要なコードを減らした

## [0.43.2] - 2026-05-18

### Bug Fixes

- FreshRSS アカウント追加で、HTTPS ではない公開 `http://` サーバー URL も登録できるようにした

### Maintenance

- Windows の `mise run app:install` を Node 経由にし、PowerShell 構文が cmd として解釈されて失敗しないようにした
- similarity report の function parser が type similarity block を混ぜて数えないようにした

## [0.43.1] - 2026-05-17

### Bug Fixes

- FreshRSS 同期時に `News` / `news` のような大文字小文字だけが異なるフォルダ名を事前に修復し、SQLite の一意インデックス作成で同期が止まらないようにした
- Windows の native shell で `mise run check` が `.CMD` / tool PATH / inline script quoting に引っかからず実行できるようにした

### Maintenance

- Windows の symlink 作成権限がない環境では該当契約テストだけを skip し、権限がある環境では従来どおり symlink 防御を検証するようにした
- リポジトリ横断スキャン系テストを並列読み込みにして、並列 check 中のタイムアウトを避けた

## [0.43.0] - 2026-05-17

### Bug Fixes

- CI の macOS Rustup bootstrap が余計な default toolchain を導入しないようにし、toolchain drift を抑えた

### Documentation

- feed content privacy と CSP tightening の preflight を追加し、今後の制約整理の入口を明確にした
- updater / OPML export / database backup/restore の sleep/resume 境界を整理した

### Maintenance

- FreshRSS pending mutation replay の監査テストを追加し、古い remote snapshot が新しい local intent を上書きしない契約を固めた
- premortem 由来の TODO を完了済みとして整理した

## [0.42.0] - 2026-05-16

### Bug Fixes

- Web Preview の読み込みタイムアウト後も、閲覧中のブラウザを勝手に閉じずに維持するようにした
- Web Preview のツールバーで閉じる・戻る・進む・再読み込みを左側にまとめ、ボタン間隔と押しやすさをブラウザ UI として自然な密度に調整した
- 記事のコンテキストメニューから記事リンクをコピーできるようにした
- ショートカットキーの長押しで同じ操作が繰り返し発火しないようにした

### Maintenance

- Browser View を遅延読み込みに寄せ、Reader 初期表示時の不要な読み込みを抑えた
- 遅延読み込みされた Web Preview の表示待ちテストを追加した

## [0.41.1] - 2026-05-15

### Bug Fixes

- Reader の日付やスマートビューなどの構造ラベルを選択不可にし、記事本文以外を誤って選択しにくくした

### Maintenance

- 設定画面のセクションラベルを共通コンポーネントへ寄せ、本文側の設定ラベルも選択不可に揃えた

## [0.41.0] - 2026-05-15

### Features

- 記事リストのコンテキストメニューからフィード URL をコピーできるようにした

### Bug Fixes

- macOS の本番 Web Preview で HTTP の記事ページが ATS にブロックされて白紙になる問題を、Web コンテンツ限定の許可で解消した
- 記事の右クリックメニューで、外部ブラウザを開く操作の文言を「ブラウザで開く」に揃えた

## [0.40.0] - 2026-05-15

### Bug Fixes

- macOS native smoke の Rust toolchain bootstrap を明示化し、CI で誤った cargo 実行ファイルを拾って失敗する状態を防いだ

## [0.39.0] - 2026-05-15

### Documentation

- Developer ID 未契約時の unsigned macOS リリース方針と手動検証手順を整理し、release workflow の期待値を追いやすくした

### Maintenance

- Storybook の Shell & Overlay 参照 canvas で update toast のサンプル同士が重ならないようにし、同じ崩れを E2E で検知できるようにした

## [0.38.3] - 2026-05-14

### Maintenance

- macOS の ad-hoc 署名ビルドで空の Apple signing identity を渡さないようにし、リリース前チェックのローカル HTTP テストが環境 proxy に影響されないようにした

## [0.38.2] - 2026-05-14

### Maintenance

- Developer ID 未契約でも macOS 版を ad-hoc 署名付きでリリースできるようにし、Gatekeeper 検証は Apple 公証情報がある場合のみ必須にした

## [0.38.1] - 2026-05-14

### Maintenance

- macOS 版リリース成果物の署名と Gatekeeper 検証を release workflow に追加し、署名情報がない状態では成果物作成前に停止するようにした

## [0.38.0] - 2026-05-14

### Bug Fixes

- Local アカウントの同期で一部フィードが失敗しても残りのフィード同期を継続し、OPML から登録し直した大量のローカル購読を扱いやすくした

## [0.37.2] - 2026-05-14

### Bug Fixes

- FreshRSS 同期時の macOS Keychain 読み取りを timeout 付き CLI 経路に切り替え、署名差分による ACL 待ちでも同期が進められるようにした

## [0.37.1] - 2026-05-14

### Bug Fixes

- macOS Keychain のパスワード読み取りが応答しない場合でも、FreshRSS 同期が「同期中」のまま固まらず復帰できるようにした

## [0.37.0] - 2026-05-14

### Bug Fixes

- FreshRSS 側で削除済みの購読がローカルに残り続け、同期のたびに警告扱いになる状態を解消した

## [0.36.0] - 2026-05-14

### Features

- macOS Keychain の再プロンプト調査用に、更新前後の署名情報を記録・比較する診断コマンドと手順を追加した

### Bug Fixes

- FreshRSS の自動再試行がアプリ停止中に期限切れになっても次回起動時に再開し、フォルダ順序の重複や同期警告の null metadata で同期結果表示が失敗しないようにした

## [0.35.0] - 2026-05-13

### Bug Fixes

- 保存済みパスワードや肥大化した dev credential store の復旧導線を整え、設定画面から credential の欠落や破損を回復しやすくした
- ショートカット設定のリセット操作を見直し、個別リセットと一括リセットの affordance を揃えて誤操作を減らした
- 記事の自動既読化後でも手動で未読に戻した状態を維持し、reader の状態変更が意図せず上書きされないようにした
- macOS overlay titlebar のドラッグ帯を shell 側の責務として復旧し、reader と購読一覧の上端でウィンドウを掴める領域を安定させた
- 記事ステータス toast の文言を簡潔にし、既読・未読操作後の通知を読み取りやすくした

### Maintenance

- Vite の静的設定を簡素化し、build 設定の見通しをよくした
- 入力欄の focus ring、選択色、設定画面の dense row typography を調整し、日常操作の視認性を整えた
- 設定画面の data / debug guidance を整理し、開発・診断向けの説明を必要な箇所へ絞った

## [0.34.0] - 2026-05-12

### Features

- WebView の読み込み進捗表示を追加し、ブラウザプレビューの状態変化を把握しやすくした

### Bug Fixes

- ブラウザオーバーレイを閉じる操作の競合を抑え、reader 側の close interaction を安定化した
- verification gate の契約を実行結果に合わせ、release 前の品質確認で拾える範囲を揃えた

### Documentation

- repository guidance routing と similarity refactor triage の方針を整理し、後続の agent 作業で参照しやすくした

### Maintenance

- Vitest の node/jsdom project 分離を進め、DOM helper、component contract、hooks、browser runtime、store、dev mock など DOM 依存の薄いテストを node 側へ移した
- browser-test globals と node 向け helper を整備し、node unit gate の並列実行と profiling を扱いやすくした
- DOM focus、animation frame、input focus、top layer、WebView timeout などの helper を整理し、reader/browser 周辺のテスト責務を分離した
- Rust doctest と YAML lint の運用ノイズを抑え、CI / mise task contract の検証を補強した

## [0.33.0] - 2026-05-11

### Features

- 同期競合、provider 診断、runtime recovery、TODO triage export の契約と補助 tooling を追加し、障害時の切り分けと後続作業の整理をしやすくした

### Bug Fixes

- sync / provider / account / DB / OPML / updater / native command の失敗境界を広く固め、破損データ、隔離アカウント、pending mutation、起動復旧、外部 URL、権限不足時の挙動を安定化した
- reader、sidebar、settings、subscriptions、browser WebView、command palette の state 復帰、focus、履歴、フィルタ、transaction、diagnostics redaction まわりの細かな不整合をまとめて修正した

### Documentation

- release、updater、native verification、privacy / security、reader recovery、accessibility、lifecycle、support policy の判断基準を整理し、完了済み TODO を大幅に圧縮した

### Maintenance

- Rust / TypeScript の契約テスト、repo quality gate、permission schema snapshot、release workflow preflight、dev mock、visual smoke、fixture 類を拡充し、回帰検知の範囲を広げた
- 大量の小粒な TODO cleanup、formatting、契約テストの追補、generated schema 更新をまとめて反映した

## [0.32.0] - 2026-05-10

### Features

- 記事移動時のアニメーション、コマンドパレットや primitive UI の参照 specimen、portless dev entrypoint を追加し、UI 確認と開発導線を広げた
- 設定から個別ショートカットをリセットできるようにし、重複する discovered feed の判別や dev runtime options の扱いを改善した
- typed result helper と Result ベースの失敗表現を導入し、フォーム、フィード、アクション、runtime option のエラー処理を段階的に揃えた

### Bug Fixes

- Reader、検索、Web プレビュー、command palette、記事タグ、購読レビュー、アカウント切り替えの stale state / race / focus 復帰をまとめて改善した
- sync、startup repair、pending mutation、feed discovery、OPML、database maintenance、updater、keyring、clipboard、window / browser WebView 境界の失敗処理と診断ログを強化した
- 設定画面、アカウント詳細、フィード編集、タグ、ミュートキーワード、フォルダ操作、通知、確認ダイアログの失敗時挙動と cache invalidation を安定化した
- release workflow、Windows dispatch、Tauri dev port 管理、Storybook / Playwright 周辺のローカル検証と CI 契約を補強した

### Documentation

- agent / llm guidance、設計指針、品質ポリシー、Rust test unwrap 方針、reader keyboard navigation、release / privacy / incident docs を更新した
- TODO の完了済み項目と次バッチ候補を整理し、後続の検証・修正タスクを追いやすくした

### Maintenance

- frontend の `lib`、hooks、schemas、reader / settings / subscriptions の type surface と helper 配置を大きく整理し、責務ごとの import 境界を明確にした
- test helpers、fixtures、Tauri mocks、Storybook runtime、query wrapper、locale / schema / command contract tests を再編し、型安全なテスト基盤へ寄せた
- reader / settings / shared UI の view props や local helper types を近い所有元へ移し、不要な re-export と重複 props を削減した
- mock sample app や古い routing shim、不要になった generated / helper ファイルを削除し、repo scan と品質ゲートのノイズを減らした

## [0.31.1] - 2026-05-08

### Features

- 購読レビュー作業画面の操作面を整理し、確認対象を扱いやすくした
- フィード追加・編集ダイアログを見直し、入力欄内アクションとフォームの見た目を統一した

### Maintenance

- フォームダイアログの shell を共有化し、タグ作成・タグ名変更・フィード編集の構造を揃えた

## [0.31.0] - 2026-05-07

### Features

- デバッグ設定から Web プレビュー上の通知表示を再現できるチェック画面を開けるようにした

### Bug Fixes

- Web プレビューの native WebView bounds と overlay chrome の座標を整理し、余計な上部 gap や端のずれを抑えた
- Web プレビューの戻るボタンを、履歴がない場合はプレビューを閉じる挙動に揃えた
- Web プレビュー上の copy / toast / tooltip が native WebView の背面に隠れにくいよう、chrome rail 内で見える配置にした
- スマートビュー選択時の下部フィルターを表示内容に合わせて同期するようにした
- 購読レビュー条件の説明文を読みやすくし、購読詳細ペインの右端余白を揃えた
- 記事一覧と Web プレビュー chrome の見た目を調整し、スクロールバー、選択面、コンパクト操作の視認性を改善した

### Maintenance

- WebView geometry と browser chrome の回帰テストを補強した
- browser tooltip 周辺の formatting を適用した

## [0.30.1] - 2026-05-07

### Features

- テーマ切り替えを View Transition API の縦ワイプ演出に更新し、reduced motion や未対応環境では即時切り替えにフォールバックするようにした

### Bug Fixes

- Windows の Tauri デバッグビルドで pnpm shim を起動できるようにし、release / native smoke の検証を復旧した

### Maintenance

- pnpm を最新の 10.33.4 に更新し、mise の npm backend 経由で CI とローカルの実行環境を揃えた
- Tauri CLI dispatch の platform 依存テストを明示化し、Windows CI でも同じ期待値で検証できるようにした

## [0.30.0] - 2026-05-07

### Bug Fixes

- 設定画面の左ナビと右コンテンツのヘッダー区切り線を揃え、アカウント詳細の表示を自然にした

### Maintenance

- npm 依存関係を更新した
- 危険ゾーンの OPML エクスポート操作が標準ボタンサイズを保つように回帰テストを補強した

## [0.29.0] - 2026-05-07

### Bug Fixes

- 設定モーダルのナビゲーション高さを安定させ、項目切り替え時の表示崩れを抑えた
- スマートビューの選択面を復元し、現在地を追いやすくした
- アカウントペインのナビゲーション対象を分離し、意図しない切り替えを防ぎやすくした

### Documentation

- リリース手順の確認回数を減らし、承認済みの公開フローを進めやすくした

### Maintenance

- Windows コマンド shim 経由でチェックを走らせるようにし、ローカル検証の再現性を上げた
- 設定画面のヘッダーとスクロール領域、アカウントナビゲーションのスタイルを整理した

## [0.28.0] - 2026-05-07

### Documentation

- 日本語 UI 文言の扱いと agent 向け指示の参照順を整理し、開発時に確認すべき文書を追いやすくした

### Maintenance

- 日本語ロケールの表現を調整し、reader / settings / sidebar / subscriptions の表示文言を自然にした
- 購読レビューと購読一覧で使うスター記事数の集計処理を共通化し、関連テストを補強した
- select option の表示と項目描画を共有部品へ寄せ、reader と shared form controls の重複を減らした
- Storybook の update toast E2E を安定化し、Windows でも Storybook 起動と表示待機が通りやすいようにした

## [0.27.0] - 2026-05-06

### Features

- アカウントヘッダーの操作を見直し、選択中アカウントの管理導線を使いやすくした
- スマートビューで一括操作のコンテキストアクションを使えるようにした
- 設定画面の日本語ラベルと検索キーワードを整理し、サイドバーやデータ管理などの旧名称でも見つけやすくした

### Bug Fixes

- フォルダの中クリック既読化で、現在のフッターフィルター状態を保つようにした
- フッターのフィルター選択がスコープ切り替え後も維持されるようにした

### Maintenance

- Storybook の explorer カバレッジを整理した
- アカウントペインの行レイアウトをそろえた

## [0.26.2] - 2026-05-05

### Bug Fixes

- フィード一覧のミドルクリックで、対象フィードの既読化確認を起動するようにした

## [0.26.1] - 2026-05-05

### Bug Fixes

- フィードを中クリックしたときに、対象サイトを開く挙動が戻るようにした

## [0.26.0] - 2026-05-05

### Features

- Web プレビューのフォーカス維持を強化し、非表示・フォーカス喪失を検知するサイトでもプレビューを読み続けやすくした
- ウィンドウを常に最前面へ固定する設定を追加し、Web プレビューを見ながら別操作をしやすくした

### Maintenance

- GitHub Actions のバージョン指定を更新し、CI と release workflow の実行環境を最新化した

## [0.25.0] - 2026-05-04

### Features

- 設定画面の「一般」「閲覧」「外観」の分類と項目名を整理し、アプリ全体、閲覧動作、見た目の設定を探しやすくした
- Web プレビューのフォーカス維持設定を追加し、プレビュー操作後のフォーカス復帰を好みに合わせて調整できるようにした

## [0.24.0] - 2026-05-03

### Features

- ReaderQuery でスマートビュー、購読スコープ、下部フィルタを正規化し、未読・スター・最近見た記事・フォルダ・フィード・タグの表示対象を一貫して扱えるようにした

### Bug Fixes

- reader の記事切り替え時にスクロール位置をリセットし、次の記事を開いたときに途中位置から始まらないようにした
- browser webview の navigation state と履歴端の preview close を安定化し、戻る・進むまわりの引っかかりを減らした
- storybook の update toast と scrolling を安定化し、UI 検証のタイミング依存を抑えた

### Documentation

- reader article scope matrix を追加し、ReaderQuery、source plan、API hook、paging order、デバッグ観点を追いやすくした
- agent 向けの導線を更新し、reader article list の仕様確認先を明確にした

### Maintenance

- article list のキーボード処理を整理し、同じ key event consume と content focus 処理を共通化した
- browser overlay の motion を追加し、preview 表示の状態変化を自然に追えるようにした

## [0.23.1] - 2026-05-02

### Bug Fixes

- browser debug geometry の offset を release artifact に含め、embedded browser の位置確認を配布版でも追いやすくした
- seed process detection を fail closed に寄せ、判定不能時に安全側へ倒れるようにした

### Documentation

- release skill の手順を調整し、tag と release notes の検証手順を明確にした

### Maintenance

- Tauri mock の未処理 command fallback を整理し、unit test の不要な validation stderr を抑えた
- Windows CI の path separator 差分が分かるよう、seed script test の portable path assertion を明示した
- CI の Vitest 出力を静かにし、失敗ログを追いやすくした

## [0.23.0] - 2026-05-01

### Features

- 本番相当データを Dev 環境へ取り込む seed task を追加し、開発時に実データに近い状態を再現しやすくした

### Bug Fixes

- RSS 同期中の全体ローディング表示をやめ、同期ボタンだけが静かに回るようにして短時間同期の体験を軽くした
- browser TODO UI の検証を安定化し、ブラウザまわりの確認がタイミングに左右されにくいようにした

### Maintenance

- Tauri dev helper と Windows command dispatch を TypeScript 化し、dev 起動・dispatch まわりの見通しを上げた
- Windows dispatch helper を分離し、関連テストと seed helper の整形を合わせて整理した

## [0.22.0] - 2026-05-01

### Features

- reader の四分割ペインをキーボードで移動できるようにし、記事一覧、本文、sidebar、browser preview 間の操作をつなげた
- command palette、settings、shared surface、件数表示などに静かな motion を広げ、状態変化を追いやすくした

### Bug Fixes

- GReader / FreshRSS の unread state を再照合し、同期後の未読状態がずれにくいようにした
- reader の recent smart view、summary card action、passive card、browser preview chrome geometry を調整し、表示と操作の引っかかりを減らした
- Debug HUD が settings、toast、overlay と重なりにくいようにし、開発時の確認 UI を邪魔しないようにした
- command palette の account 欠落 feed、browser retry の URL 欠落、reading sort preference の toggle を防御的に扱った

### Documentation

- Base UI primitive ownership、runtime chrome review、button reference、motion follow-up guardrail を整理し、UI レビュー基準を追いやすくした
- 完了済み reading recovery notes を整理し、残りの cleanup 候補を TODO に記録した

### Maintenance

- date-fns ベースの日時 helper、display preset guard、motion constants、action registry、window event helper などを型安全に整理した
- sidebar、subscriptions、article list、settings、command palette、tag picker の view model / helper を分離し、責務の境界を明確にした
- pure helper、settings props builder、browser geometry、sidebar mapping、clipboard、HTML normalization などのテストを補強した
- CI の actionlint shellcheck hang を避け、Tauri / frontend の検証を安定させた

## [0.21.0] - 2026-04-27

### Features

- 最近見た記事の履歴を追加し、アプリ再起動後も閲覧文脈をたどりやすくした
- reader で中クリックした feed をそのまま既読にできるようにし、一覧整理を素早く行えるようにした

### Bug Fixes

- reader の記事移動を矢印キーで扱えるようにし、キーボード操作の引っかかりを減らした
- packaged build の identifier を安定化し、配布ビルドで設定や保存先がぶれないようにした
- Tauri の dev build 設定と macOS の stale bundle cleanup を調整し、開発起動まわりの失敗を抑えた

### Documentation

- 閲覧復帰ロードマップ、recent article settings の回帰メモ、完了済み TODO の整理を反映した

### Maintenance

- recent article history の上限や日付処理、window event helper、共通 helper を整理し、関連コードの見通しを上げた
- validation schema / types と component date handling を分離整理し、責務の切り分けを進めた
- settings の recent article preference テストと article list の account mock を補強し、回帰確認を厚くした
- Vite dev server caching を無効化し、Windows 向け Tauri dispatch test と CI まわりの安定性を上げた

## [0.20.0] - 2026-04-26

### Bug Fixes

- reader の unread view で read 済みになった選択中の記事を残し、操作中に記事が消える引っかかりを減らした
- FreshRSS の unread count をローカル記事状態から再計算し、サーバー側 backfill が空のときも表示件数がずれないようにした
- CI の sidebar focus 検証を feed 描画まで待つようにして、タイミング依存の失敗を抑えた
- browser preview の import guard format を整え、CI 上の非 Windows import 判定を安定させた

### Documentation

- design token guidance を実装状況に合わせ、reader verification follow-up を記録・完了扱いにした

### Maintenance

- Windows 向けタスクを native shell 経由に寄せ、`mise run ci` と Tauri build が WSL 側の依存解決へ流れないようにした
- Tauri の generated Windows schema を更新した

## [0.19.0] - 2026-04-25

### Features

- feed や folder を選んだときに最初の記事を自動で開くようにし、reader の遷移を減らした
- 記事未選択時の summary card、マウスの戻る/進む操作、folder display mode action を追加し、reader 操作を進めやすくした
- tag settings の行レイアウトを reader 側とそろえ、設定画面でもタグ管理を見通しやすくした
- account 追加用の debug entry point と Debug HUD の情報階層を整え、開発時の確認導線を強化した

### Bug Fixes

- Debug HUD の action 群を共通 button に寄せつつ borderless 化し、レイアウト崩れと操作しづらさを抑えた
- reader の utility icon action、選択行、記事タイトル幅、null article body、embedded webview の Escape close を調整し、記事操作時の引っかかりを減らした
- account setup 中の sync progress 表示、初回 sync 中の lock、sync feedback、detail form layout を見直し、settings のセットアップ体験を安定させた
- FreshRSS の full sync と state refresh を軽くし、starred の一時的な null 応答も吸収して同期の不安定さを減らした
- sample personal data の sanitize を追加し、privacy サンプルで実データが混ざるリスクを下げた

### Documentation

- Debug HUD、tag settings、account setup lock、mobile chrome button の設計メモを追加し、今回の UI 調整意図を追いやすくした
- Codex desktop debugging tools と passive card の optical centering ガイドを追記し、開発時の確認基準を明確にした

### Maintenance

- Debug HUD と tags settings 周辺の Storybook / テスト expectation を更新し、見た目調整後の回帰確認を補強した
- Debug HUD の action wrapper や settings の loading action button を整理し、共通 UI 部品への寄せを進めた

## [0.18.1] - 2026-04-22

### Bug Fixes

- restore browser overlay drag region

## [0.18.0] - 2026-04-21

### Bug Fixes

- prioritize selected startup account
- simplify account switcher menu labels
- refine feed tree hierarchy
- tighten top hierarchy
- add preview action feedback
- preserve retained article state
- keep subscriptions alphabetical
- remove subscription sort control
- align FreshRSS unread counts
- follow greader continuation for remote state
- filter unread queries before pagination
- align sidebar header control sizing
- normalize sidebar footer action sizing
- align folder trigger sizing and focus states
- default auto-mark delay to 0.3s
- add delayed auto-mark options
- avoid blank window on restart shortcut
- prefer label categories for subscription folders
- exclude muted articles from sidebar counts

### Documentation

- clarify tauri screenshot guidance
- document mcp and skill routing
- centralize routing in CLAUDE
- clarify dev data environments
- compare dev run modes

### Maintenance

- align unread filtering fixtures
- reuse snapshot adoption checks
- centralize summary tone styles
- share account sync datetime parsing
- deduplicate browser url effect setup
- deduplicate auto-mark timing cases
- centralize invalidation helpers
- enable mcp bridge for dev debugging
- include darwin in supported architectures

## [0.17.0] - 2026-04-20

### Bug Fixes

- use RSS icon for subscriptions entry
- preserve disclosure trigger focus ring
- keep selected article rows free from focus outlines
- route tauri tasks through portable dispatcher
- optimistically move feeds between folders
- extend shared scroll content lanes
- share scroll content lane
- align article list selection lane
- restore hover-only feed tree handles
- share feed tree row shell
- isolate rust test target on windows
- spawn vite directly in dev manager
- detect quoted vite entrypoints
- add subscriptions root context menu
- refine article selection hierarchy
- scope mark all read to current selection
- polish article empty state presence
- stabilize dark article surfaces
- refine loopback network error handling
- restore workspace header stories
- refine article empty state placement
- polish sidebar hierarchy and desktop header spacing
- polish sidebar account header
- share calm hover motion for dense workspaces
- calm hover motion across subscriptions

### Documentation

- refresh window chrome guidance
- track sidebar polish follow-ups

### Maintenance

- remove remaining lightweight local state
- unify lightweight local state in settings
- unify lightweight local state in reader
- unify lightweight controller state
- normalize helper imports
- remove unsafe chart style injection
- reduce react doctor warnings
- simplify overlay toolbar actions
- normalize accounts modal view state
- extract browser overlay chrome actions
- improve stable mock UI behavior
- reduce lightweight similarity findings
- reduce react doctor warnings in mocks
- sync Tauri package version
- streamline mise lint and install tasks

## [0.16.0] - 2026-04-19

### Features

- reader の empty state を state-aware に見直し、アカウント未設定・フィード未登録時の案内と CTA を分かりやすくした
- Debug settings で現在の認証情報 backend を表示し、dev file credentials と OS keyring の切り替え導線を確認しやすくした

### Bug Fixes

- Windows 本番 build で keyring backend が mock に落ちる構成を修正し、Credential Manager への保存検証が失敗する問題を解消した

### Documentation

- release workflow の tag guard を補強し、release commit / tag / version file の整合確認を明文化した

### Maintenance

- `mise run app:dev:native-keyring` を追加し、開発中でも OS keyring backend を明示的に使って確認できるようにした
- reader の refreshed empty state と debug backend 表示のテスト coverage を追加した
- biome formatting を適用し、reader / settings 周辺の整形を揃えた

## [0.15.0] - 2026-04-19

### Bug Fixes

- settings navigation の選択状態を安定化し、アカウント nav label の clipping と selection shift を防いだ
- biome ignore pattern を修正し、build folder が check 対象に混ざる問題を防いだ

### Documentation

- FreshRSS connection summary の design spec を追加した
- typography table formatting を整え、design doc の markdown lint を通した
- README / llms.txt / documentation entrypoint を現在の構成に同期した

### Maintenance

- system font stack と calmer surface motion へ寄せ、Windows を含む desktop app の typography / hover tone を安定化した
- biome formatting を適用し、settings/account 周辺の整形を揃えた

## [0.14.0] - 2026-04-18

### Features

- dev intent scenario を拡張し、settings の account-add intent を追加した

### Bug Fixes

- subscriptions workspace が Escape 操作で確実に閉じるよう修正した
- tauri vite manager import を guard し、dev 起動時の失敗を防いだ

### Maintenance

- unsupported な Inoreader integration を削除した
- locale 依存の UI expectation を緩和し、テストの安定性を高めた

## [0.13.1] - 2026-04-18

### Maintenance

- frontend package versions を更新し、`@biomejs/biome`、`@praha/byethrow`、`i18next`、`react-i18next`、`shadcn`、`typescript` を現行パッチへ揃えた
- `biome.json` の schema version を `2.4.12` に合わせ、依存更新後も formatter/lint gate がそのまま通るようにした

## [0.13.0] - 2026-04-18

### Features

- reader pane の表現を簡素化し、記事ヘッダー・本文・empty state の情報階層を見直して読みやすさを改善した
- Feed Cleanup に review action を追加し、購読候補の継続/保留判断を進めやすくした
- tag management settings・sidebar tag actions・mute keyword filtering を追加し、整理系ワークフローを設定画面から扱えるようにした
- subscriptions index と cleanup surface を分離し、workspace 管理と購読整理の導線を整理した
- startup sync account preference、sidebar density setting、screen snapshot hook を追加し、起動時同期と表示状態の扱いを強化した
- Inoreader account setup と shared credentials を settings から扱えるようにし、beta 表示で導線を明確にした
- subscriptions / cleanup を filtered review state と grouped feed collapse を軸に再整理し、レビュー主導の購読整理フローを強化した
- reader の記事タイトルを Web Preview で開けるようにし、starred article 専用 source と browser overlay navigation controls を追加した
- command palette に theme command を追加し、テーマ遷移もアニメーション付きで扱えるようにした
- dev scenario に subscriptions index の導線を追加し、購読整理レイアウトの確認をしやすくした

### Bug Fixes

- reader pane の階層・余白・article tag chip・article toolbar frame を調整し、記事表示の窮屈さを減らした
- settings modal のスクロール、form layout、navigation surface、picker/dialog surface を見直し、設定画面の操作性を安定させた
- sidebar の選択行、compact row height、leading control を揃え、ナビゲーションの視認性を改善した
- article/account snapshot 保持、stale unread count 再計算、content text reconciliation を修正し、更新前後の状態不整合を減らした
- macOS titlebar inset・drag strip・overlay chrome と browser-mode 補助 UI を調整し、デスクトップ実機での表示崩れを抑えた
- Storybook の i18n fallback crash、favicon 404 noise、fixed wrapper 起因の mobile overflow を解消し、狭幅確認を安定させた
- mobile toolbar discoverability、article list footer filter chips、cleanup の action row / selection rail を調整し、狭幅時の窮屈さを減らした
- subscriptions workspace を Escape と狭幅レイアウトで安定させ、pane close と scroll の破綻を防いだ
- unsupported account services の非表示、credential edit の整理、greader network failure の分類で provider 設定の不整合を減らした
- starred / account cache の optimistic patch と backfill を補強し、star/unstar 後の一覧状態を崩れにくくした
- workspace header / overlay chrome の drag region・text selection・header inset を調整し、macOS で掴みやすさと視認性を両立させた
- sidebar の sync button feedback、tooltip label、cooldown 表示を整理し、手動 sync の状態が分かりやすくなった
- sidebar sync status の永続化と manual sync throttle を入れ、起動直後や連打時の不安定な再同期を抑えた
- article list footer filter と auto mark timing 設定を詰め、reader の既読化タイミングと footer 操作感を安定させた
- data settings の action rail と settings navigation を揃え、debug settings は dev build に閉じるよう修正した

### Documentation

- reader pane simplification、button commonization、mute keyword settings、sqlite-first snapshot などの設計メモを追加した
- release manual verification、incident runbook、feed content privacy/CSP 方針を docs に整理し、release 前後の確認項目を明文化した
- plan task/document の見出しと metadata formatting を揃え、ローカル設計ノートの表記を整理した
- surface role governance、browser overlay shell role、layout stability、settings form rules を DESIGN/TODO/plan docs に反映した
- Feedly/provider follow-up と issue-managed backlog を TODO から切り出し、未完了タスクを追いやすくした
- compact action feedback の指針と、起動時 sync 優先度の将来タスクを TODO / DESIGN に追記した

### Maintenance

- settings / shared / reader helper の contract を整理し、button・nav row・workspace panel 周辺の共通化を進めた
- browser overlay / reader / cleanup surface の token と theme surface を見直し、画面間の見た目のばらつきを減らした
- focus debug HUD と browser surface fallback card の構成を整理し、overlay 検証時のノイズを減らした
- account detail の cache/error toast と reader の feed query cache を small helper へ寄せ、状態更新ロジックの重複を減らした
- app-shell の modal entry point 遅延読み込み、frontend dependency 更新、jsdom animation compatibility 修正で開発基盤を整えた
- settings / subscriptions / cleanup / reader の surface governance と radius 整理を進め、shell / section / info card / utility detail の役割を明確にした
- popup / disclosure / theme の motion primitive を統一し、workspace chrome 全体の遷移トーンを揃えた
- subscriptions / cleanup / storybook の shell・backdrop・detail surface を横断的に見直し、lighter workspace baseline へ寄せた
- Storybook explorer のカテゴリ整理、loading/browser overlay/workspace header preview の追加、shared panel coverage 拡充で UI 参照面を強化した
- issue templates と release check gate の整備で、開発とリリースの運用を安定させた
- roving focus / adjacent item navigation / browser URL effect / Tauri listener cleanup を共通 helper 化し、reader 周辺の state 処理を整理した
- startup sync throttle 定数、menu / runtime constants、React の eager initializer 回避を進め、アプリ起動時の挙動と保守性を整えた

## [0.11.0] - 2026-04-14

### Features

- Web プレビューを main stage の fullscreen viewer として扱えるようにし、通常表示とオーバーレイ表示の体験を揃えた
- Web プレビューのツールバー action を記事ツールバーに寄せ、重複していた close / browser 導線を整理した
- Feed Cleanup に一括継続/保留と優先度表示を追加し、購読候補の仕分けを進めやすくした
- sync の retry-pending 状態と次回再試行タイミングを sidebar / settings から確認できるようにした

### Bug Fixes

- fullscreen Web プレビューの chrome / overlay root / compact preview / geometry diagnostics を見直し、狭い幅や Tauri 実機でも表示が崩れにくいようにした
- Settings モーダルのスクロール、account rename 反映、account detail / add-account / shortcut controls の狭幅レイアウト、settings 内の web preview launch action を修正し、設定操作時の不整合と窮屈さを減らした
- Feed Cleanup を画面幅に追従するレイアウトへ調整し、overview / queue / review の重なりや情報過密、broken references 画面の圧縮を修正した
- Storybook の i18n fallback crash、favicon 404 noise、固定幅 wrapper による mobile overflow を解消し、狭幅巡回を安定させた
- browser-mode の `get_account_sync_status` validation error、Web プレビューのショートカット、smart view の status 表現、sidebar footer action の見え方を調整し、reader 補助 UI を磨いた
- reader を sub-640px で single-pane 優先に見直し、記事ヘッダー操作や touch target の窮屈さを改善した
- focus debug HUD の配置と shell を見直して overlay strip を除去し、browser surface fallback card の狭幅表示も広げて debug / fallback 導線を確認しやすくした
- article list item の pointer / keyboard semantics を整理し、row 操作の a11y warning を解消した

### Documentation

- fullscreen Web プレビュー geometry の spec / plan と、Feed Cleanup の copy / 情報設計メモを追加した
- release 前の native/manual verification checklist と incident runbook を追加し、CI 外で見るべき確認点を明文化した
- feed content の privacy/CSP 方針、repository context file、UI review ベースの TODO を更新し、次の改善ポイントを整理した

### Maintenance

- browser view / sidebar / feed cleanup / account detail まわりの責務分割を進め、reader 実装のリファクタを継続した
- settings / shared / reader helper の contract を types file に寄せ、view props / controller hook の境界を整理した
- settings page の preference view props input、account detail の cache/error toast、reader の feed/folder cache invalidation を shared helper に寄せて重複を減らした
- debug HUD と image viewer 周辺を整理し、fullscreen preview 検証用の内部構成を簡素化した
- responsive Storybook・Vitest・e2e の回帰確認を増やし、テスト名の整理とローカル release skill の追加で開発フローと release 準備を整えた

## [0.10.0] - 2026-04-09

### Features

- Web プレビューを immersive な Minimal Viewer へ再設計し、通常起動と `open-web-preview-url` intent 起動を同じ viewer shell に統一した
- Web プレビュー用の geometry model と debug tooling を追加し、HUD・native bounds・dev intent の再現導線を強化した
- Smart View の contextual filter と sidebar hierarchy を整理し、フォルダ選択ベースの記事絞り込み導線を追加した
- アカウント loading action のローカライズや、wide sidebar toggle animation など、主要 UI 操作の体験を拡張した

### Bug Fixes

- Web プレビューの close chrome、surface guidance、empty state、validation feedback、debug image viewer の崩れを修正した
- フィード整理画面の日付ローカライズ、キュー優先表示、日本語 UI ラベル残りを修正した
- sidebar の選択フォルダ同期、スクロール縮退、記事本文の重複フィードラベル、未読遷移中の表示保持を修正した
- FreshRSS endpoint 解決、重複フィード upsert、保存済みパスワード検証など、同期とアカウント設定の不整合を修正した
- pane sizing と narrow-width viewer guardrail を見直し、狭幅でも主要導線が壊れにくいようにした

### Documentation

- Web Preview Minimal Viewer の設計 spec / implementation plan を追加した
- folder selection feed filter、sidebar refactor、settings loading button などの設計メモを追加した
- TODO ベースで reader UX と overlay 検証結果を整理し、完了項目を反映した

### Maintenance

- overlay root の app shell への引き上げ、sidebar section 分割、feed tree 表示責務の抽出など、reader/layout 実装を整理した
- dev intent / runtime env / Tauri capability contract のテストを拡充し、node type 追加や generated formatting の調整を行った
- 開発用 env 名と debug flow を整理し、Windows でも再現しやすい Tauri dev 起動へ寄せた

## [0.9.0] - 2026-04-06

### Bug Fixes

- Windows / Linux をまたぐ CI チェックを安定化し、format・clippy・unit test の落ちやすい箇所を修正した
- preference contract テストを CRLF checkout でも通るようにし、Windows 固有の失敗を防いだ

### Maintenance

- Reading List まわりを中心に、遅い runner でも揺れにくいテスト構成へ整理した
- feed editor 系 UI の display preset 判定と clipboard feedback を shared helper へ抽出した
- test helper の Tauri command call 型を共通化し、モック定義の重複を減らした

## [0.8.0] - 2026-04-06

### Features

- フィード整理画面に broken references の surfacing を追加し、孤立記事や参照切れの修復導線を強化した
- フィード単位で同期を再実行できる refetch command を追加した
- feed cleanup 用の dev launch intent を追加し、検証導線を増やした
- フィード整理画面と編集 UI を追加し、メンテナンス導線をアプリ内へ統合した

### Bug Fixes

- 主要導線の `Webプレビュー` 用語を整理し、reader / browser 表記の混在を解消した
- Webプレビュー中のコンテキスト表示と close 責務を明確にし、記事 close と混同しにくくした
- sidebar の選択状態を強め、現在地が分かりやすい見た目へ調整した
- モバイル幅で主要アイコンボタンの hit area を 44px 基準へ引き上げた

### Maintenance

- sidebar 共通部品を shared へ抽出し、favicon と section toggle の重複を整理した
- destructive action 周りの shared UI を標準化した

## [0.7.0] - 2026-04-05

### Features

- Feed Cleanup 画面を追加し、古い購読候補のレビューと削除判断をアプリ内で行えるようにした
- 起動時同期プリファレンスを追加し、アプリ起動直後のフル同期可否を設定できるようにした
- Reader mode / Web preview mode の 2 軸へ表示設定を整理し、プレビュー切り替えと表示導線を改善した
- command palette に dev scenarios を追加し、設定画面・ナビゲーション・画像 viewer などの smoke 導線を共通ランタイムで扱えるようにした
- ネイティブメニューと共有系アクションの文言を言語設定に追従させ、設定画面では copyable server URL を表示できるようにした
- フィード landing、フォルダ作成/移動、直接フィルタショートカット、デスクトップ sidebar toggle など reader 操作を拡張した

### Bug Fixes

- 同期 warning の surfacing、feed state 保持、invalid account selection からの復帰など、同期と sidebar 周りの安定性を改善した
- フィード編集ダイアログでのコピー後 focus 維持、preview toggle の常時利用、browser overlay close 操作の視認性を修正した
- dedicated browser window stall 時の fallback、外部ブラウザ起動、dev scenario の状態復元とタグ反映を修正した
- FreshRSS の local-like feed state、missing password recovery、credential save 後の接続テストなど、アカウント設定まわりの不整合を解消した
- マイグレーション時の feed mode 欠損や dev/prod バンドル境界に起因する表示崩れ・挙動差を修正した

### Documentation

- Feed Cleanup、startup sync、preview toggle / Web preview role、dev scenarios command palette、folder drag-and-drop などの設計メモを追加した
- TODO / agent guidance / 開発ルールの表記を整理し、Codex app での選択 UI 方針を明文化した

### Maintenance

- preview toggle まわりの story / test / 実装構成を整理し、legacy display mode UI を削除した
- dev scenario runtime の lazy load・production 分離・履歴管理を見直し、開発専用導線のノイズを減らした
- reader / settings / sync 周辺のテストと整形を調整し、release gate チェックを安定化した

## [0.6.0] - 2026-04-01

### Features

- ローカルプロバイダーで条件付き RSS 取得をサポートし、release ビルド向けのファイルログ出力を追加した
- 共通の `PlatformInfo` / capability 基盤を導入し、OS ごとの UI 表示・機能可否・認証情報フローを一元化した
- アプリ内ブラウザを dedicated window ベースへ移行し、外部ブラウザ起動やトップレベル URL 管理の扱いを改善した

### Bug Fixes

- Windows のブラウザビューで WebView2 の戻る/進む可否とネイティブ履歴操作を使うようにし、インストーラに WebView2 bootstrapper を同梱するようにした
- モバイル幅でサイドバーや設定導線が画面外へ退避する問題、記事検索のアクセシビリティ不足、ペイン位置ずれを修正した
- `未読` ビューで `すべて既読にする` 実行後も記事が残る問題や、フィルタ済み記事がナビゲーションまで残留する挙動を修正した
- フィード未選択時の表示モード継承、記事ヘッダー日付のローカライズ、設定プリファレンス契約、デスクトップ上端ギャップを修正した
- ブラウザ mock / browser window / platform info の各種読み込み・close・fallback・retry 挙動を安定化した
- 開発用 credential path 互換性と database optimization フローを堅牢化した

### Documentation

- sync 整合性ルール、CSP 方針、verification scope、tmp artifact 運用を README / docs に整理した
- file logging、platform OS abstraction、mobile pane recovery、browser mock consistency、browser pane toolbar alignment の設計メモを追加した
- フィード表示モード継承の plan 見出しやルール索引など、開発ドキュメントの表記を整備した

### Maintenance

- sync プロバイダーの non-delta フロー整理、GReader delta sync 検証、共有 UI 定数抽出などで実装基盤を整理した
- app icon / reading list / platform 判定を capability ベースへ寄せ、backend の OS 分岐も共有 platform 情報へ統一した
- mark-all-read 確認フローや dedicated browser window 周辺をリファクタし、ブラウザ・記事表示周りのテストを拡充した
- CI / ローカル開発設定を見直し、Windows Rust test・browser mock UI・tmp / worktree artifact の扱いを改善した

## [0.5.0] - 2026-03-30

### Features

- アカウント詳細にパスワード伏せ字表示、接続テスト、手動同期アクションを追加
- 同期進捗イベントを導入し、進捗バー・ローディング状態・部分失敗表示を UI に反映
- アカウント単位の同期コマンド、指数バックオフ付きスケジューリング、既読記事パージ統合、GReader 差分同期カーソルを追加
- 設定画面に DB 管理機能を追加し、サイズ表示、手動 VACUUM、自動バックアップ、記事保持 60 日設定を提供
- タグの記事数表示と記事一覧をアカウント単位で絞り込めるようにした
- 選択中アカウントの永続化と、開発モード向けファイルベース認証情報ストアを追加
- アップデーターの再確認フローと、インストール済みアプリの quarantine 解除・署名・起動タスクを追加

### Bug Fixes

- 同期スケジューラ変更に対するコードレビュー指摘を反映し、マイグレーション復旧処理を堅牢化
- ブラウザ起動で許可する URL スキームを `http` / `https` に限定
- macOS 開発環境でのキーチェーン ACL 競合とランタイム時のアプリアイコン置換を修正
- 開発用ウィンドウサイズ、オーバーレイタイトルバー、記事リストの Feed Title ヘッダー表示を修正

### Documentation

- 重い TODO 項目を GitHub Issues に移行し、残タスクに前提条件と難易度メモを追加した（#17, #18, #19）
- 同期、バックアップ、URL スキーム制限、記事保持、UI 改善に関する TODO の完了状況を更新
- DB マイグレーション復旧とアップデーター署名フォールバックの設計メモを整理
- superpowers 用プラン文書と開発ルールの表記を整備

### Maintenance

- ブラウザビューを iframe から Tauri Webview ベースへ置き換え、自動同期開始条件を見直した（#16）
- sync コマンド群の分割、`SyncResult` 導入、未使用同期モジュール削除で同期基盤を整理
- `mise` タスクを RTK ラップに切り替え、`app:dev` の開発設定と認証情報フローを改善
- アカウント詳細・起動時同期・ブラウザ Webview 周りのテストを追加し、アップデーター署名設定の検証を強化
- アプリアイコンの余白と開発向けビルド設定を調整
- `tracing_subscriber` 初期化と production 用 bundle identifier 上書き設定を整備

## [0.4.0] - 2026-03-30

### Features

- コマンドパレット（⌘Shift+K）でフィード/記事/設定への素早いアクセス + アクション実行
- Zod による IPC リクエスト/レスポンスバリデーション（safeInvoke）
- スライディングペーンのトランジションアニメーション（モバイル/コンパクト）
- DB バックアップ/リストア機能と初期化時の自動統合
- 同期の排他制御（concurrent sync prevention）
- シェアメニュー（ツールバー + 設定トグル）
- タグカラーピッカー
- サービスピッカー（アカウント追加の2ステップフロー）
- GradientSwitch コンポーネント（Base UI ダークテーマスタイル）
- サイドバーセクションの表示/非表示設定
- フィードごとの表示モード切替
- 確認ダイアログのリデザイン（アイコン対応）
- アカウント認証情報の編集機能
- ツールチップ追加（記事リストヘッダー/サイドバー）
- リロード/停止ボタンのトグル表示
- FreshRSS/Inoreader 接続バリデーション
- 署名付き開発ビルドタスク（Keychain ダイアログ回避）
- 各種設定項目の動作反映（unread_badge, font_style, font_size, layout, grayscale_favicons, sidebar preferences 等）
- 初回ユーザー向けアカウント追加ガイダンス
- macOS バックグラウンドでのリンク開放
- フィードセクション折りたたみ
- Dock アンリードバッジ
- ショートカットリセット確認ダイアログ
- テーマ連動アプリアイコン切替

### Bug Fixes

- GReader アイテム ID の正規化で既読状態が正しく同期
- GReader ストリーム取得上限を 50→200 に拡大
- webview の font-family 継承修正
- アカウント「説明」→「名前」ラベルリネームと編集ヒント改善
- gradient-switch OFF 状態の修正
- クロスオリジン iframe リロード修正
- settings ScrollArea のスクロール修正
- ブラウザ back/forward ボタンの disabled 状態修正
- macOS アプリアイコンの角丸マスク適用
- Select ポップアップの z-index 修正（Dialog overlay 対応）
- ウィンドウドラッグの有効化（タイトルバー/サイドバーヘッダー）
- フィード未読数の再計算修正（既読マーク後）
- 「お気に入り」→「スター」表記統一
- サブスクリプションソート順の保持
- タグピッカー Escape キーのスコープ修正
- ブラウザビューの embed フォールバック改善
- カラートークンの体系化（accent, ring, destructive）

### Maintenance

- フォーム要素の Base UI 移行（Input, Select, RadioGroup）
- Storybook コンポーネント分離
- SidebarNavButton 共通コンポーネント抽出
- feed-tree-view の冗長フラグメント除去
- PR labeler ワークフロー追加
- feature branch → PR → merge 運用確立
- リリースコマンドの3フェーズ構造リデザイン
- テストカバレッジ改善（コマンドパレット、確認ダイアログ、同期排他制御等）

## [0.3.1] - 2026-03-29

### Features

- PR Insights Labeler ワークフロー追加

### Bug Fixes

- アプリアイコンを透過 PNG に変換（白背景の除去）
- リリースワークフロー CI 失敗の修正とビルドスクリプト承認

### Maintenance

- GitHub Actions を Node.js 24 互換バージョンにアップグレード
- リリースマトリクスから macos-13 x86_64 を削除

## [0.3.0] - 2026-03-28

### Features

- macOS ネイティブメニューバー（View / Accounts / Subscriptions / Item / Share）(#6)
- 自動アップデーター（tauri-plugin-updater + Ed25519 署名検証）(#9)
- カスタムアプリアイコン (#10)
- i18n 対応（日本語/英語切替、react-i18next + 言語設定永続化）
- UI 刷新（About メニュー、オーバーレイタイトルバー、記事リストリデザイン）
- アカウントリネーム機能 + server_url 表示
- タグ管理 API（リネーム/削除、記事数取得）
- カスタムキーボードショートカットのプリファレンス連携
- 最近既読の記事トラッキング（recentlyReadIds）
- ConfirmDialog（window.confirm を完全置換）
- feed_discovery モジュール公開

### Bug Fixes

- スイッチコンポーネントのサイズ・パディング調整
- アカウント名バリデーションをバイト数→文字数カウントに修正
- フィードディスカバリーに SSRF 保護を追加
- 検索ページネーション修正 + LIKE ワイルドカードエスケープ
- プリファレンスキーの ALLOWED_KEYS 許可リスト更新
- フィルターボタン順序修正（Unread → All → Starred）
- 同期状態・共有記事アイコンの整列
- createMutation の型安全性修正（TData ジェネリック追加）

### Maintenance

- Bionic Reading モジュール・設定を完全削除
- React Query の createQuery/createMutation ファクトリ抽出
- ハードコードされたショートカットラベルを i18n キーに置換
- Unknown Feed のセンチネル値によるグルーピング改善
- テストヘルパー（createWrapper）共通化
- GitHub Actions リリースワークフロー整備

## [0.1.0] - 2026-03-27

### Features

- FreshRSS 双方向同期（既読/スター、フォルダ階層、ページネーション、バックグラウンド定期同期、sync-on-wake）
- 設定画面（General / Appearance / Reading / Shortcuts / Actions / Bionic Reading）+ SQLite 永続化
- i18n（日本語/英語切替、react-i18next）
- フィードディスカバリー（サイト URL → RSS フィード自動検出）
- キーボードショートカット一式 + カスタマイズ UI
- アカウント管理（追加/削除/リネーム、同期間隔設定）
- タグ管理（リネーム/削除、記事数表示、コンテキストメニュー）
- FTS5 全文検索（日本語対応 + LIKE フォールバック）
- OPML エクスポート
- macOS ネイティブメニューバー（View / Accounts / Subscriptions / Item / Share）
- Bionic Reading（太字比率設定 + 記事ビュー適用）
- ConfirmDialog（window.confirm 完全置換）

### Bug Fixes

- 記事リストプレビューの HTML タグ生表示を修正
- 検索の日本語混在テキスト対応
- 記事アクションボタンの既読/スター状態反映
- 設定トグルスイッチの表示崩れ修正
- Unread ビューで既読記事がグレーアウト表示に変更

### Improvements

- 3 ペインレイアウト（サイドバー、記事リスト、記事ビュー）
- フィルターボタンのサイクル UX 改善
- 同期ボタンのローディング + 完了通知
- 記事ヘッダーのリンク化（タイトル→WebView、フィード名→フィードへ移動）
- 記事リストツールバーに全既読ボタン追加
- フィード編集ダイアログにフォルダ割り当て追加

### Maintenance

- Storybook 導入
- コンポーネント分割（settings-modal, sidebar）
- UI コンポーネント統一（CVA button）
- dev ツール追加（markdownlint, yamllint, mise タスク）
