# Ultra RSS Reader — TODO

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
