---
paths:
  - "src/**/*.{ts,tsx}"
---

# Preferences 読み書きパターン

## 制約

- preferences の読み取りは `usePreferencesStore((s) => s.prefs.key ?? "default")` のセレクタ形式を使う
- デフォルト値は `??` で各コンポーネント側に書く（stores/preferences-store.ts の `defaults` と一致させる）
- 書き込みは `setPref(key, value)` を使う。直接 `prefs` を変更しない
- preferences の値は全て `string` 型。boolean は `"true"` / `"false"` で管理する

## 根拠

Zustand のセレクタパターンにより、対象の pref が変わった時のみ再レンダリングされる。store 全体を購読すると全設定変更で全コンポーネントが再レンダリングされてしまう。

## 例

### 正しい

```typescript
// 個別セレクタで必要な値だけ購読
const dimArchived = usePreferencesStore((s) => s.prefs.dim_archived ?? "true");
const textPreview = usePreferencesStore((s) => s.prefs.text_preview ?? "true");

// 書き込み
const setPref = usePreferencesStore((s) => s.setPref);
setPref("theme", "dark");
```

### 不正

```typescript
// store 全体を購読 — 全 pref 変更で再レンダリング
const { prefs, setPref } = usePreferencesStore();

// prefs を直接変更 — 永続化されない
prefs.theme = "dark";
```

## 強制

- [x] 手動レビュー
