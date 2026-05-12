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
- [ ] 環境変数の変更時: `.env` を暗号化 (`dotenvx encrypt`)

---

<!-- レビューボットの自動生成コメントはここに挿入されます -->
