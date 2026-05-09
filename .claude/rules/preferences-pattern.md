---
paths:
  - "src/**/*.{ts,tsx}"
---

# Preferences 読み書きパターン

## 制約

- preferences の読み取りは必要な値だけを購読するセレクタ形式を使う
- 既知 preference の default / legacy value / invalid value fallback は `src/schemas/preferences.ts` の `preferenceDefaults` と `resolvePreferenceValue` を source of truth にする
- component 側に ad hoc な `?? "default"` を増やさず、既存の selector / view-props hook / resolver pattern に寄せる
- 書き込みは `setPref(key, value)` を使う。直接 `prefs` を変更しない
- preferences の値は全て `string` 型。boolean は `"true"` / `"false"` で管理する
- 新しい preference を追加する時は frontend schema/default、Tauri allowlist、load normalization、persist failure surface、UI selector の5点を同じ変更範囲で確認する
- persist failure は optimistic state を維持するか rollback するかを明示し、ユーザーに見せるべき失敗は toast で通知する
- browser API や storage と連動する preference は、runtime unavailable / throwing API / listener cleanup を focused test に含める

## 根拠

Zustand のセレクタパターンにより、対象の pref が変わった時のみ再レンダリングされる。store 全体を購読すると全設定変更で全コンポーネントが再レンダリングされてしまう。

Preference は UI state であると同時に local persisted data でもあるため、schema normalization と persistence failure behavior を揃えないと、表示値・保存値・起動時 fallback が drift する。

## 例

### 正しい

```typescript
// 個別セレクタで必要な値だけ購読
const dimArchived = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "dim_archived"));
const textPreview = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "text_preview"));

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

// component 固有 default を増やして schema default と drift させる
const dimArchived = usePreferencesStore((s) => s.prefs.dim_archived ?? "true");
```

## 強制

- [x] 手動レビュー
