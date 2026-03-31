# Ultra RSS Reader — TODO

## UI ブラウザ散策メモ

- [x] Windows として動作するブラウザ mock でも、設定画面の文言に `⌘` 表記が残っている
  - 再現: ブラウザモード (`http://127.0.0.1:4173/`) で設定を開き、`一般 > 記事一覧` のトグル文言を見る
  - 現状は `⌘クリックでアプリ内ブラウザを開く` と表示されるが、Windows では `Ctrl` 系の表記に寄せたい
  - 候補箇所: `src/locales/ja/settings.json`, `src/locales/en/settings.json`
- [x] ブラウザモード用 mock の未読件数が記事データと一致しておらず、1件既読にしただけで件数が大きく跳ぶ
  - 再現: ブラウザモードで任意の記事を1件開くと、サイドバーの未読件数がそのフィード全件ぶん減ったように見える
  - `mockFeeds[].unread_count` の初期値と `mockArticles` の実件数がずれており、`recalcUnread()` 実行後に表示が急変する
  - 候補箇所: `src/dev-mock-data.ts`, `src/dev-mocks.ts`

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

## 自動アップデートの署名検証とロールバック

- [ ] アップデート失敗時のフォールバック動作をテストする → [#18](https://github.com/jey3dayo/ultra-rss-reader/issues/18)

## 同期パフォーマンス改善

- [ ] 差分同期の最適化（最終同期時刻以降の変更のみ取得） → [#17](https://github.com/jey3dayo/ultra-rss-reader/issues/17)

## tracing の初期化と観測性確保

- [ ] リリースビルドではファイルログ出力を検討する（ユーザーがログを添付してサポート依頼できる導線）
  - `tracing-appender` crate でローリングファイル出力を追加
  - ログローテーション（日次 or サイズベース）、保持期間の設計が必要
  - 設定画面からログディレクトリを開けると便利

## リリース用 bundle identifier の確定

- [ ] 変更後、updater endpoint・OS 上のアプリ識別・データディレクトリへの影響を確認する → [#19](https://github.com/jey3dayo/ultra-rss-reader/issues/19)
