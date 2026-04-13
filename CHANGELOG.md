# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/)

## [Unreleased]

### Features

- Web プレビューを main stage の fullscreen viewer として扱えるようにし、通常表示とオーバーレイ表示の体験を揃えた
- Web プレビューのツールバー action を記事ツールバーに寄せ、重複していた close / browser 導線を整理した

### Bug Fixes

- fullscreen Web プレビューの chrome / overlay root / compact preview / geometry diagnostics を見直し、狭い幅や Tauri 実機でも表示が崩れにくいようにした
- Settings モーダルのスクロールと account rename の反映を修正し、設定操作時の不整合を減らした
- Feed Cleanup を画面幅に追従するレイアウトへ調整し、review panel と broken references 画面の圧縮や重なりを修正した
- Web プレビューのショートカット、smart view の status 表現、sidebar footer action の見え方を調整し、reader 補助 UI を磨いた
- article list item の pointer / keyboard semantics を整理し、row 操作の a11y warning を解消した

### Documentation

- fullscreen Web プレビュー geometry の spec / plan と、Feed Cleanup の copy / 情報設計メモを追加した
- repository context file と UI review ベースの TODO を更新し、次の改善ポイントを整理した

### Maintenance

- browser view / sidebar / feed cleanup / account detail まわりの責務分割を進め、reader 実装のリファクタを継続した
- debug HUD と image viewer 周辺を整理し、fullscreen preview 検証用の内部構成を簡素化した
- テスト名の整理とローカル release skill の追加で、開発フローと release 準備を整えた

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
