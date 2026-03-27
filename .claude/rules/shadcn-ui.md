---
paths:
  - "src/components/**/*.{ts,tsx}"
---

# shadcn/ui コンポーネントルール

## `src/components/ui/` は直接編集しない

- shadcn/ui が生成したコンポーネント（`src/components/ui/`）のデフォルトスタイルを変更しない
- カスタマイズは利用側で `className` props を渡し、`cn()` の tailwind-merge で上書きする
- やむを得ず ui/ を編集する場合はコミットメッセージに理由を明記する

## レスポンシブプレフィックスの上書き

- デフォルト値に `sm:max-w-sm` のようなレスポンシブプレフィックス付きクラスがある場合、上書きは同じプレフィックスで指定する
- 例: `sm:max-w-sm` を上書き → `sm:max-w-[920px]`（`max-w-[920px]` だけでは上書きされない）

## コンポーネント構成

- アプリ固有コンポーネントは `src/components/reader/` または `src/components/settings/` に配置
- ファイル名は kebab-case（`article-list.tsx`）、コンポーネント名は PascalCase
- 300 行を超えたら分割を検討
- 分割時は同じディレクトリ内にファイルを抽出する（例: `feed-item.tsx`, `folder-section.tsx`）
