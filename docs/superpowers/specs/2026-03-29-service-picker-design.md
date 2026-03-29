# Service Picker Design

## Summary

アカウント追加画面の UI を Select ドロップダウンからサービスアイコンリスト（NetNewsWire スタイル）に変更する。
サービス選択と設定入力を2段階フローに分離し、モーダル内でスライド遷移する。

## Motivation

現在の Select ドロップダウンではサービスが増えるほど選びにくくなる。
アイコン + カテゴリ分けのリスト形式にすることで、サービスの視認性と拡張性を向上させる。

## Scope

- `AddAccountForm` を2段階フロー（ServicePicker → AccountConfigForm）に分離
- サービスアイコンリストの新規コンポーネント作成
- モーダル内のスライド遷移アニメーション
- Rust 側の変更なし

## Design

### フロー

```text
Step 1: ServicePicker（サービス選択）
  ↓ サービスをクリック（右スライド）
Step 2: AccountConfigForm（設定入力）
  ↑ Back ボタン（左スライド）
```

### Step 1: ServicePicker

カテゴリ別にグループ化したサービスリスト。

#### カテゴリ構成

| カテゴリ    | サービス  | 状態                                                     |
| ----------- | --------- | -------------------------------------------------------- |
| Local       | Feeds     | 実装済み                                                 |
| Self-Hosted | FreshRSS  | 実装済み                                                 |
| Self-Hosted | Fever     | 未実装（deprecated、グレーアウト + disabled で表示のみ） |
| Services    | Inoreader | 実装済み                                                 |

> **Note:** Fever は `AddAccountProviderKind` に未定義。本スペックではリストにグレーアウト表示するが、クリック時は何もしない（将来の実装または削除判断まで）。Rust 側の変更は不要。

#### 各行のレイアウト

```text
[アイコン 36x36] [名前 + サブテキスト]                    [>]
```

- アイコン: サービス固有の色付き角丸正方形 + SVG アイコン
- 名前: 14px font-weight:500
- サブテキスト: 12px text-muted-foreground（URL or 説明）
- シェブロン: 右端に `ChevronRight` アイコン
- Deprecated サービス: `opacity-50` + "Deprecated. Not recommended." テキスト

### Step 2: AccountConfigForm

選択したサービスの設定入力フォーム。既存の `AddAccountForm` から Select 部分を除いたもの。

#### ヘッダー

```text
[← Back]        [サービス名]        [spacer]
```

- Back ボタンで Step 1 に戻る（左スライド）
- サービス名を中央に表示

#### サービス情報バナー

フォーム上部にアイコン + サービス名 + 説明を表示（どのサービスを設定しているか明示）。

#### フォーム内容

既存と同じ。`getAddAccountFormConfig(kind)` で動的にフィールドを切り替える。

### スライド遷移

- CSS `transform: translateX()` + `transition` で実装（追加ライブラリ不要）
- Step 1 → 2: 左にスライドアウト / 右からスライドイン
- Step 2 → 1: 右にスライドアウト / 左からスライドイン
- duration: 200ms ease-out
- `prefers-reduced-motion` 時はアニメーション無効化

### アイコン管理

サービス定義を配列で一元管理する:

```ts
// リスト表示専用の kind。AddAccountProviderKind に含まれないサービスも表示できる
type ServiceKind = AddAccountProviderKind | "Fever";

type ServiceDefinition = {
  kind: ServiceKind;
  icon: ComponentType<{ className?: string }>;
  iconBg: string; // Tailwind gradient classes
  description: string; // i18n key
  disabled?: boolean; // true の場合、グレーアウト + クリック不可
};

type ServiceCategory = {
  label: string; // i18n key
  services: ServiceDefinition[];
};
```

- `disabled: true` のサービスは `button` 要素に `disabled` 属性を付与し、`opacity-50 cursor-not-allowed` でグレーアウト
- `onSelect` コールバックは `disabled` でないサービスのみ発火する

- 汎用アイコン（RSS）: lucide-react の `Rss` を使用
- サービス固有ロゴ: 将来必要になったら `src/components/icons/` に SVG コンポーネントを追加

### コンポーネント構成

```text
src/components/settings/
├── add-account-form.tsx      (既存: 2段階フローの親コンポーネントに改修)
├── service-picker.tsx         (新規: サービスアイコンリスト)
└── account-config-form.tsx    (新規: 設定入力フォーム、既存フォーム部分を抽出)
```

### アクセシビリティ

- サービスリスト: `role="list"` + 各アイテム `role="listitem"` 内の `button` 要素
- カテゴリ: `role="group"` + `aria-labelledby` でカテゴリ名を参照
- フォーカスリング: `focus-visible:ring-2 focus-visible:ring-ring`
- タッチターゲット: 最低 44px 確保（`py-2.5` + アイコン高さ）
- Deprecated/未実装サービス: `disabled` 属性付き `button` で表示。スクリーンリーダーにも無効状態が伝わる
- スライド遷移: `prefers-reduced-motion: reduce` で無効化
- Back ボタン: `aria-label="Back to service selection"`

### i18n

既存の `settings` namespace に以下のキーを追加:

- `account.category_local`, `account.category_self_hosted`, `account.category_services`
- `account.local_desc`, `account.freshrss_desc`, `account.fever_desc`, `account.inoreader_desc`
- `account.back_to_services`

## Testing

- `service-picker.test.tsx`: カテゴリ表示、サービスクリックでコールバック発火、deprecated 表示
- `account-config-form.test.tsx`: Back ボタン、フォーム送信、バリデーション
- `add-account-form.test.tsx`: 2段階フローの遷移（既存テストを改修）
