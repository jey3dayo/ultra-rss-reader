---
paths:
  - "src/components/**/*.{ts,tsx}"
---

# shadcn/ui / Base UI コンポーネントルール

## `src/components/ui/` は直接編集しない

- `src/components/ui/` は shadcn recipe を起点にした Base UI wrapper の置き場として扱う
- runtime primitive は Base UI を優先し、shadcn は recipe / CLI / style preset / registry 設定として維持する
- `cmdk` は command palette / accessible command UI 用の別ライブラリとして維持し、`cmdk` 経由の transitive Radix は Base UI 移行の削除対象にしない
- shadcn/ui が生成したコンポーネント（`src/components/ui/`）のデフォルトスタイルを安易に変更しない
- カスタマイズは利用側で `className` props を渡し、`cn()` の tailwind-merge で上書きする
- Base UI wrapper の保守、recipe 追従、a11y / focus bugfix、runtime primitive 方針との整合修正に限り `ui/` の編集を許可する
- やむを得ず `ui/` を編集する場合はスコープを最小化し、コミットメッセージまたは完了報告に理由を明記する

## レスポンシブプレフィックスの上書き

- デフォルト値に `sm:max-w-sm` のようなレスポンシブプレフィックス付きクラスがある場合、上書きは同じプレフィックスで指定する
- 例: `sm:max-w-sm` を上書き → `sm:max-w-[920px]`（`max-w-[920px]` だけでは上書きされない）

## コンポーネント構成

- アプリ固有コンポーネントは `src/components/<feature>/` に配置
- 既存の feature 境界は `reader/`, `settings/`, `subscriptions-index/` を優先する
- 複数 feature で使うコンポーネントは `src/components/shared/` に配置
- ファイル名は kebab-case（`article-list.tsx`）、コンポーネント名は PascalCase
- 300 行を超えたら分割を検討
- 分割時は同じディレクトリ内にファイルを抽出する（例: `feed-item.tsx`, `folder-section.tsx`）
