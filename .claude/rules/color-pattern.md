---
paths:
  - "src/components/**/*.{ts,tsx}"
  - "src/styles/**/*.css"
---

# インタラクティブ要素のカラーパターン

## ON / Active 状態

- アクセントカラーには `ring`（`oklch(0.65 0.15 250)` = 青）を使う
- CSS 変数: `var(--color-ring)`、Tailwind: `ring` / `bg-ring`
- 適用例: Switch の ON、選択中のタブ、フォーカスリング

## OFF / Inactive 状態

- 暗いグレー `gray-600` 系を使う
- CSS 変数: `var(--color-gray-600)`
- 背景に溶け込みつつ、要素の存在は認識できる明度にする

## 注意

- `primary`（`oklch(0.92 0 0)` = ほぼ白）はテキストやボタンラベル用。トグル系 UI のアクセントには使わない
- `input`（`oklch(0.28 0 0)`）はフォーム入力のボーダー/背景用。トグルの OFF 色には暗すぎるため `gray-600` を優先する
- 新しいトグル系コンポーネント（Checkbox、Radio 等）を追加する際も同じパターンを適用する
