# Dev Scenarios + Command Palette Design

## Overview

Ultra RSS Reader の既存 `dev intent` を、起動時に状態を注入する単発実装から、再利用可能な `DevScenario` ハーネスへ整理する。  
この `DevScenario` は `dev build` でのみ利用可能とし、起動時の env 注入とコマンドパレットの両方から実行できるようにする。

狙いは 3 つある。

- 表示状態、ナビゲーション状態、ダイアログ状態を素早く再現できるようにする
- `add feed` や `reload` などの通常操作は既存 `AppAction` に残し、将来の正式機能と整合させる
- 新しいシナリオを足すたびにテストケースも自然に増える構造にする

## Requirements

- 既存の `image-viewer-overlay` intent を後方互換で維持する
- `dev build` でのみ `Dev Scenarios` をコマンドパレットに表示する
- コマンドパレットでは通常操作の `Actions` と `Dev Scenarios` を別グループで表示する
- `add feed`、`sync-all`、`reload-webview` などの通常操作は `AppAction` として扱い続ける
- 複数の UI state やデータ選択をまとめて再現するものは `DevScenario` として扱う
- 起動時 env 注入とコマンドパレット起動が同じ scenario 実装を共有する
- scenario 追加時に単体テストを増やしやすい構造にする

## Decisions

### Product Direction

- まずは `dev` 用に整え、良いものだけ将来正式機能に寄せる
- `command palette` と `intent` は両方使う
- `Dev Scenarios` は `dev build` でだけ表示する
- 通常操作と dev 再現シナリオは同じ場所に置くが、UI 上はグループを分ける

### Responsibility Split

| Kind          | Role                                                     |
| ------------- | -------------------------------------------------------- |
| `AppAction`   | ユーザー向けの単発操作。将来そのまま正式機能になりうる   |
| `DevScenario` | dev-only の再現ハーネス。複数 state や流れをまとめて再現 |
| `dev intent`  | 起動時に scenario id を 1 回実行する入口                 |

判断基準はシンプルに保つ。

- 1 アクションで完結するものは `AppAction`
- 複数 state の設定やデータ選択をまとめて行うものは `DevScenario`

## Approach

既存の `dev intent` 実装を scenario runner に薄く載せ替える。  
起動時の env 注入とコマンドパレット選択は、どちらも `runDevScenario(id)` を呼ぶだけにし、ロジックの重複を避ける。

通常操作は既存の `executeAction()` をそのまま使う。  
`DevScenario` から通常操作を呼びたい場合も、直接 store をいじらず `executeAction()` を使うことで、将来の正式機能との整合を保つ。

## Architecture

### New Files

| File                             | Purpose                                                |
| -------------------------------- | ------------------------------------------------------ |
| `src/dev/scenarios/types.ts`     | `DevScenario` / `DevScenarioId` / context 型定義       |
| `src/dev/scenarios/registry.ts`  | scenario 一覧と id 解決                                |
| `src/dev/scenarios/runner.ts`    | scenario 実行エントリ。起動時注入とパレットで共用      |
| `src/dev/scenarios/helpers.ts`   | feed / article 選定や共通 state 操作の補助関数         |
| `src/dev/scenarios/index.ts`     | 公開 API                                               |

### Modified Files

| File                                                | Change                                                   |
| --------------------------------------------------- | -------------------------------------------------------- |
| `src/lib/dev-intent.ts`                             | env 値を scenario id に解決する入口へ整理                |
| `src/hooks/use-dev-intent.ts`                       | 起動時に `runDevScenario()` を 1 回だけ呼ぶ hook に整理  |
| `src/components/reader/command-palette.tsx`         | `dev build` 時のみ `Dev Scenarios` グループを追加        |
| `src/__tests__/lib/dev-intent.test.ts`              | parser の後方互換テストを registry ベースへ更新          |
| `src/__tests__/components/command-palette.test.tsx` | `Dev Scenarios` 表示・選択のテスト追加                   |

### Scenario Type

```ts
type DevScenarioId =
  | "image-viewer-overlay"
  | "open-feed-first-article"
  | "open-tag-view"
  | "open-add-feed-dialog"
  | "sync-all-smoke";

type DevScenario = {
  id: DevScenarioId;
  title: string;
  keywords: string[];
  run: (ctx: DevScenarioContext) => Promise<void> | void;
};

type DevScenarioContext = {
  ui: typeof useUiStore.getState;
  queryClient: typeof queryClient;
  actions: {
    executeAction: typeof executeAction;
    listAccounts: typeof listAccounts;
    listFeeds: typeof listFeeds;
    listArticles: typeof listArticles;
  };
};
```

### Data Flow

#### Env Injection

1. `VITE_ULTRA_RSS_DEV_INTENT` を読む
2. env 値を `DevScenarioId` に解決する
3. `useDevIntent()` が初回 mount 時に `runDevScenario(id)` を呼ぶ
4. runner が scenario を実行し、必要な query cache / UI state / action を適用する

#### Command Palette

1. `dev build` 時だけ `Dev Scenarios` グループを表示する
2. ユーザーが scenario を選択する
3. `runDevScenario(id)` を呼ぶ
4. 実行後に palette を閉じる

## Command Palette Integration

`CommandPalette` は以下の 2 系統を同居させる。

- `Actions`: 既存の `AppAction`
- `Dev Scenarios`: dev-only の再現ハーネス

見た目は分けるが、検索体験は揃える。

- title と keywords で検索できる
- 通常操作と同様に 1 項目として選択できる
- `Dev Scenarios` は `import.meta.env.DEV` のときだけ表示する

これにより、`open-add-feed` や `sync-all` のような通常機能と、`open-tag-view` のような再現専用コマンドを同じ入口で扱える。

## Initial Scenarios

### 1. `image-viewer-overlay`

既存 intent の移植先。  
後方互換の基準ケースとして最初に残す。

### 2. `open-feed-first-article`

特定 feed を選び、最初の表示可能な article まで到達する。  
表示状態とナビゲーション状態の土台になる。

### 3. `open-tag-view`

tag 選択状態と article list の再現。  
ナビゲーション系の確認に向く。

### 4. `open-add-feed-dialog`

`executeAction("open-add-feed")` を呼ぶ最小の UI flow scenario。  
通常操作と scenario の責務分離を確認しやすい。

### 5. `sync-all-smoke`

`executeAction("sync-all")` を呼ぶ軽量 smoke scenario。  
loading / toast / progress まわりの観察に使う。

`reload-webview-smoke` は同系統の 2 段目候補とする。

## Testing Strategy

テストは 4 層に分ける。

### 1. Parser / Registry Tests

- env 値から正しい `DevScenarioId` を解決できる
- 不正値は `null` になる
- registry から scenario 定義を取得できる

### 2. Scenario Runner Tests

- `open-add-feed-dialog` が `executeAction("open-add-feed")` を呼ぶ
- `sync-all-smoke` が `executeAction("sync-all")` を呼ぶ
- `open-feed-first-article` が期待する UI state を作る
- `image-viewer-overlay` が既存と同じ browser URL 解決を行う

### 3. Command Palette Component Tests

- `dev build` のときだけ `Dev Scenarios` グループが出る
- 通常の `Actions` と `Dev Scenarios` が混ざらない
- scenario を選ぶと palette が閉じる
- scenario の title / keywords で検索できる

### 4. Startup Injection Tests

- env 注入で scenario が 1 回だけ実行される
- scenario 実行失敗時に toast が出る
- `image-viewer-overlay` の後方互換が維持される

## Delivery Plan

### PR 1: Scenario Infra

- `DevScenario` 型、registry、runner を追加
- 既存 `image-viewer-overlay` を scenario に移植
- parser / runner テスト追加

### PR 2: Palette Integration

- `CommandPalette` に `Dev Scenarios` グループ追加
- `dev build only` 表示
- scenario 選択テスト追加

### PR 3: First Scenario Set

- `open-feed-first-article`
- `open-tag-view`
- `open-add-feed-dialog`
- `sync-all-smoke`

各 scenario に対応する runner test を追加する。

## Risks

- `useDevIntent()` にデータ取得・state 操作が寄りすぎると再利用性が落ちる  
  runner と helper に寄せて hook は薄く保つ
- `AppAction` と `DevScenario` の境界が曖昧になると責務が崩れる  
  単発操作は `AppAction`、複合再現は `DevScenario` のルールを維持する
- `dev build only` 分岐が palette テストを複雑にする  
  表示判定は純粋関数または小さな helper に分離してテストしやすくする

## Out of Scope

- `Dev Scenarios` の production 露出
- ユーザー設定での開発者モード切り替え
- scenario の永続保存や共有 UI
- `AppAction` の全面再設計
- provider を跨ぐ重い live integration 自動化
