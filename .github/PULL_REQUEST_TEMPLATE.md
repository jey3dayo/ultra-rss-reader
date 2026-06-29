## 概要

<!-- 変更内容の概要を記載 -->

## 種別

- [ ] 🚀 feature (新機能)
- [ ] 🐛 fix (バグ修正)
- [ ] 📚 docs (ドキュメント)
- [ ] 🔧 chore (その他)
- [ ] 💥 breaking (破壊的変更)

## 影響範囲

<!-- 変更が影響する機能・サービスを記載 -->

- [ ] フロントエンド (React / TypeScript)
- [ ] バックエンド (Rust / Tauri)
- [ ] データベース (SQLite / rusqlite)
- [ ] API連携 (FreshRSS / GReader)
- [ ] CI/CD
- [ ] ドキュメント

## 追加確認が必要な面

該当する場合のみ、確認内容を「確認済み」または PR 本文に記録する。
個人アプリのため重い運用承認は不要だが、packaged build やローカルデータを壊しやすい変更は見落とさない。

- [ ] release / updater / packaged app / keyring / account auth / startup に影響する
- [ ] SQLite schema migration または `LATEST_VERSION` を変更する
- [ ] OPML import/export、database backup/restore、native file dialog、partial artifact、cancel/retry に影響する
- [ ] Web Preview、article HTML rendering、CSP、remote content privacy に影響する
- [ ] app shell、design-system barrel、command palette など startup bundle に影響しうる

### Release / native 確認

release、updater、packaged app、keyring、account auth、packaged startup に触る場合のみ記録する。
`mise run ci` は live-service / packaged-app checks までは含まないため、該当する manual smoke は
`docs/release-manual-verification.md` から選ぶ。

- 該当する manual smoke:
- 実施結果または skipped reason:
- artifact / digest / log / screenshot などの evidence:

### Schema bump 確認

SQLite migration または `LATEST_VERSION` に触る場合のみ記録する。
schema bump 後は旧バージョンでの起動がブロックされるため、rollback ではなく fix-forward 前提で確認する。

- migration from/to:
- downgrade block を release note に書く必要:
- backup 推奨文または不要な理由:
- fix-forward 判断基準:

### Startup bundle 確認

app shell、design-system barrel、command palette、lazy import 境界、Vite build 設定に触る場合のみ記録する。

- 測定コマンド:
- initial JS/CSS の変化:
- `cmdk` など command-palette-only dependency が initial chunk に入っていないこと:
- 変化を許容する理由、または follow-up:

## 関連Issue

<!-- fixes #123 形式で記載、複数ある場合は改行して記載 -->

## 確認済み

DOM/CI/focused test は `mise run test:unit:dom` / `mise run ci` / focused test の確認を指します。

- [ ] 動作確認完了
- [ ] 型エラー 0 件 (`mise run check` の `lint:types`)
- [ ] リント違反 0 件 (`mise run check` の `lint`)
- [ ] 高速テスト成功 (`mise run check` の `test:unit:fast` / `test:rust`)
- [ ] フォーマッター適用済み (`mise run check` の `format`)
- [ ] jsdom / DOM / React rendering / PR handoff / release / native / Storybook 影響時: DOM/CI/focused test を記録
- [ ] 追加確認が必要な面に該当する場合: focused test、manual smoke、release note、または skipped reason を記録
- [ ] Release / native 確認に該当する場合: manual smoke の evidence または skipped reason を記録
- [ ] Schema bump 確認に該当する場合: release note / backup / fix-forward 方針を記録
- [ ] Startup bundle 確認に該当する場合: bundle 測定結果または skipped reason を記録
- [ ] 環境変数の変更時: `.env` を暗号化 (`dotenvx encrypt`)

---

<!-- レビューボットの自動生成コメントはここに挿入されます -->
