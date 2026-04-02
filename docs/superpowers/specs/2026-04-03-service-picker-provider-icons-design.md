# Service Picker Provider Icons Design

## Summary

アカウント追加の `ServicePicker` で、サービス種別が一目で分かるようにアイコンを見直す。
`Local` は PC を想起させるローカル実体の記号にし、`FreshRSS` と `Inoreader` は RSS 汎用記号ではなく公式ロゴ形状を使う。

## Scope

- `Local` のアイコンを PC 系アイコンへ変更
- `FreshRSS` と `Inoreader` のアイコンを公式ロゴ由来の SVG に変更
- 背景色を各サービスの識別に寄せたフラットな色へ調整
- `ServicePicker` のレイアウト、文言、遷移、挙動は変更しない

## Design Decisions

### Local

- 現在の `Rss` では「ローカル保存」より「RSS 規格」が強く見える
- `Monitor` 系アイコンを使い、端末内ローカルソースであることを優先して伝える

### FreshRSS

- FreshRSS 公式サイトのロゴ形状を白抜きで使う
- 背景はブランドブルー `#0062BE`
- 既存の緑グラデーションよりもサービスの固有性を優先する

### Inoreader

- Inoreader の公式アプリアイコン由来の白抜きマークを使う
- 背景はブランドブルー `#1875F3`
- SaaS サービスとしての識別性を強める

## Implementation Notes

- 依存追加は行わず、SVG は React コンポーネントとして `src/components/icons/` に閉じ込める
- `ServicePicker` のサービス定義差し替えだけで完結させる
- 既存テストは文言中心のため、大きなテスト更新は不要。対象コンポーネントの回帰だけ確認する
