# Browser Mock Consistency Design

## Overview

browser mode での UI 散策中に、実装本体ではなく browser-only mock 固有の不整合が 2 つ見つかった。

- Windows 扱いの mock でも、設定画面に `⌘クリックでアプリ内ブラウザを開く` が残る
- mock の `unread_count` が記事データと一致せず、1 件既読にしただけで件数が大きく跳ぶ

今回の変更では、この 2 点だけを対象にして、OS 表示の一貫性と browser mock の再現性を上げる。
本体機能の挙動変更や、設定画面全体の文言整理、mock データの全面刷新はスコープに含めない。

## Goals

- browser mock が返す Windows platform 情報と、設定画面の修飾キー表示を一致させる
- browser mock の未読件数を `mockArticles` と整合させ、既読化で不自然に大きく件数が跳ばないようにする
- 既存の browser mode 散策フローを壊さずに修正する

## Non-Goals

- 本番データや Tauri 実機での unread 集計ロジックを変更すること
- 設定文言の全面的な i18n リライトを行うこと
- browser mock の全 fixture を現実的な件数へ作り直すこと

## Current State

### 1. Modifier 表示

- `src/dev-mocks.ts` の `get_platform_info` は `kind: "windows"` を返している
- 一方で `src/locales/ja/settings.json` / `src/locales/en/settings.json` の `general.cmd_click_browser` は `⌘` 固定文言になっている
- そのため Windows 扱いの browser mock でも、設定画面だけ macOS 表示が残る

### 2. Mock unread count

- `src/dev-mock-data.ts` の `mockFeeds[].unread_count` は固定値
- `src/dev-mocks.ts` では既読化時に `recalcUnread(feedId)` で `mockArticles` ベースへ再計算している
- 初期表示時は固定値、操作後は再計算値に切り替わるため、件数が急変する

## Approach Options

### Option 1: 最小パッチ

- locale の `⌘` を `Ctrl` 固定へ置換
- `mockFeeds[].unread_count` を手で実件数へ合わせる

メリット:

- 変更が最小

デメリット:

- macOS 表示の考慮が弱い
- mock article を増減すると再び件数がずれる

### Option 2: 表示と mock 集計を派生値へ寄せる

推奨案。

- 修飾キー文言は platform 情報から動的に組み立てる
- unread count は `mockArticles` から初期化時に再計算する

メリット:

- Windows / macOS どちらの mock にも対応しやすい
- fixture 更新時の再発を防ぎやすい

デメリット:

- locale の key と設定画面側の受け渡しを少し触る必要がある

### Option 3: mock 専用の例外処理

- browser mode のときだけ表示文言と unread count を補正する

メリット:

- 局所対応できる

デメリット:

- 実装意図が分かりにくく、保守しづらい

## Recommended Direction

Option 2 を採用する。

理由:

- 今回の問題はどちらも「source of truth が固定文や固定数値になっている」ことが原因
- 表示は platform 由来、件数は article fixture 由来に寄せると、今後の browser mock 散策でも再発しにくい

## Design

### A. Settings modifier label

`general.cmd_click_browser` は修飾キー込みの完成文ではなく、修飾キーを差し込める文言に変更する。

例:

- ja: `{{modifier}}クリックでアプリ内ブラウザを開く`
- en: `{{modifier}}-click opens in-app browser`

`GeneralSettings` 側では platform 情報を参照し、macOS は `⌘`、それ以外は `Ctrl` を渡す。

既存の shortcut 表示 helper と責務が近いため、新しい OS 判定ロジックは増やさず、既存の platform 情報に寄せる。

### B. Mock unread initialization

`mockFeeds[].unread_count` は fixture の正解値として扱わず、browser mock 初期化時に `mockArticles` から再計算する。

想定方針:

- `src/dev-mocks.ts` に全 feed 対象の再計算関数を用意する
- `setupDevMocks()` 実行時に一度だけ全 feed の unread count を同期する
- 既存の `recalcUnread(feedId)` は、既読化後の局所更新としてそのまま使う

これにより、初期表示時も操作後も同じ集計ルールになる。

## Files to Change

- `src/components/settings/general-settings.tsx`
- `src/locales/ja/settings.json`
- `src/locales/en/settings.json`
- `src/dev-mocks.ts`
- 必要に応じて関連テスト

## Testing

### Browser mock / frontend

- Windows platform mock で設定画面を開いたとき、`⌘` ではなく `Ctrl` 系表示になる
- macOS platform を与えた場合は `⌘` 表示を維持できる
- browser mode 初期表示時の unread count が `mockArticles` に基づく値になる
- 記事 1 件を既読化したとき、対象 feed と全体件数が 1 件単位で自然に減る

### Regression

- フィード追加ダイアログ、検索、記事選択の browser mock 操作が従来どおり動く
- 既存の shortcut / platform 表示テストがあれば期待値を壊さない

## Risks

### Locale key responsibility drift

文言組み立てを settings 側に寄せると、locale に完成文を置く前提から少し外れる。
ただし今回は 1 箇所だけで、OS 差分を埋め込む責務としては妥当。

### Mutable mock fixtures

`mockFeeds` / `mockArticles` は mutable な配列なので、初期化関数を何度も呼ぶと予期せぬ状態が混ざる可能性がある。
必要なら「起動時 1 回だけ同期する」形に限定する。

## Done Criteria

- Windows browser mock で `cmd_click_browser` 表示が `⌘` のままにならない
- browser mock の unread count が初期表示から `mockArticles` と一致する
- 記事既読化後の件数変動が急跳びしない
- 既存の frontend チェックと対象テストが通る
