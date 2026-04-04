---
paths:
  - "src/dev/scenarios/**/*.ts"
  - "src/lib/dev-intent.ts"
  - "src/lib/dev-scenario-runtime.ts"
  - "src/lib/dev-scenario-ids.ts"
  - "src/hooks/use-dev-intent.ts"
  - "src/components/reader/command-palette.tsx"
  - "src/__tests__/dev/scenarios/**/*.ts"
  - "src/__tests__/hooks/use-dev-intent.test.tsx"
  - "src/__tests__/components/command-palette.test.tsx"
---

# Dev Scenario / Command Palette ルール

## 制約

- 起動時 `intent` と command palette の dev scenario 実行は、必ず共通 runner を通す。入口ごとに別の hydration ロジックを増やさない
- `useDevIntent()` は env を読んで scenario 実行を起動する薄い hook に保つ。実処理は `src/dev/scenarios/` 側へ寄せる
- command palette から dev scenario を実行する時も、scenario 本体を直接 import せず runtime loader 経由で呼ぶ
- `Dev Scenarios` は `import.meta.env.DEV` のときだけ表示・実行可能にする。production bundle に dev scenario 実装を直接含めない
- 単発の通常操作は `AppAction` に残す。`open-add-feed`、`sync-all`、`reload-webview` のような操作を scenario 専用実装へ複製しない
- `DevScenario` は複数の UI state やデータ選択をまとめて再現する用途に限る。通常操作を呼ぶだけの scenario は `actions.executeAction()` を使う
- scenario の state 再現は provider-backed data と実際の query key に合わせる。架空の tag / article などを cache にだけ注入して UI を成立させない
- command palette の recent history は通常操作を優先し、dev scenario を通常 action 履歴へ混ぜない

## テスト方針

- scenario id を追加したら `registry` / `dev-intent` 側の純粋関数テストを更新する
- scenario を追加したら `runner` テストで UI state か `AppAction` dispatch を必ず固定する
- command palette に関わる変更では、「dev build でだけ見える」「選択で実行される」「palette が閉じる」を確認する
- startup injection に関わる変更では、`useDevIntent()` が 1 回だけ実行することと、失敗 toast を維持することを確認する

## 判断基準

- 1 アクションで完結するなら `AppAction`
- 複数 state の再現や検証ハーネスなら `DevScenario`
- 入口は複数あっても、実装本体は 1 つに保つ

## 避けること

- `useDevIntent()` や `command-palette.tsx` の中で scenario ごとの個別分岐を増やす
- dev scenario のためだけに production 側の import 経路を太くする
- 実 UI が参照しない cache key や synthetic data に依存した scenario を追加する
- 通常機能の操作を `AppAction` と `DevScenario` の両方で二重実装する

## 強制

- [x] 手動レビュー
