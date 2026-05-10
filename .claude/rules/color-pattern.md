---
paths:
  - "src/components/**/*.{ts,tsx}"
  - "src/styles/**/*.css"
---

# インタラクティブ要素のカラーパターン

## ON / Active 状態

- アクセントカラーには warm primary 系の `ring`（light: `rgba(245, 78, 0, 0.26)`, dark: `rgba(245, 78, 0, 0.38)`）を使う
- CSS 変数: `var(--color-ring)`、Tailwind: `ring` / `bg-ring`
- 適用例: Switch の ON、選択中のタブ、フォーカスリング

## OFF / Inactive 状態

- 暗いグレー `gray-600` 系を使う
- CSS 変数: `var(--color-gray-600)`、switch track token: `var(--gradient-switch-track-off)`
- 背景に溶け込みつつ、要素の存在は認識できる明度にする

## 注意

- `primary` は brand CTA 用。トグル系 UI のアクセントは `ring` / `gradient-switch-track-on` を優先する
- `input` はフォーム入力のボーダー/背景用。トグルの OFF 色には暗すぎるため `gray-600` / `gradient-switch-track-off` を優先する
- 新しいトグル系コンポーネント（Checkbox、Radio 等）を追加する際も同じパターンを適用する
