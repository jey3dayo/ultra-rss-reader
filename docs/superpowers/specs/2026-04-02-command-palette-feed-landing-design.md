# Command Palette Feed Landing Design

## Overview

Ultra RSS Reader のコマンドパレットで `@` プレフィックスから購読を選んだとき、単なる feed 選択ではなく「その feed の最新記事へ着地」できるようにする。
着地先は feed ごとの実効表示モードに従う。

- 実効表示モードが `normal` の場合:
  - feed を選択し、最新記事を reader に表示する
- 実効表示モードが `widescreen` の場合:
  - feed を選択し、最新記事を選択したうえで browser view に表示する

この挙動は将来の Codex / CLI / deep link 連携でも再利用できるよう、コマンドパレット固有の分岐として埋め込まず、小さな intent として切り出す。

## Goals

- `@` で購読を検索し、Enter でその feed の最新記事へ一発で着地できる
- 「最新」の定義を既存 article list の並び順と一致させる
- feed の `display_mode` と global `reader_view` の precedence を守る
- コマンドパレットからの移動だけで UX を完結させる
- 将来の自動操作入口が再利用できる共通 intent を作る

## Non-Goals

- サイドバー click の挙動を変更すること
- 専用デバッグ画面を追加すること
- 初回実装で CLI 引数や deep link を追加すること
- 「最新」の定義を別ロジックで再設計すること
- 外部ブラウザを強制的に開くこと

## Approved UX

### Command Palette Behavior

- コマンドパレットの `@` グループで feed を選んで Enter すると、既存の「feed を開く」より一段深い landing を行う
- feed 行の意味は「その feed の最新へ移動」に変わる
- コマンドパレットを使う目的は「購読を探すこと」より「見たい状態へ最短で飛ぶこと」を優先する

### Landing Rules

- feed に記事が 1 件以上ある:
  - 最新記事を選択する
  - 実効表示モードが `normal` なら reader 着地
  - 実効表示モードが `widescreen` なら browser view 着地
- feed に記事が 0 件:
  - feed を選択して article list まで表示する
  - 自動で article / browser は開かない
- 最新記事に URL が無い:
  - browser view は開かず、reader 着地にフォールバックする

### Latest Definition

- 「最新」は article list の先頭と同じ意味にする
- つまり、現在の sort 規則と同じ並び順で先頭要素を採用する
- feed 単位 landing で別の `latest` 判定を持ち込まない

## Chosen Approach

UI 上はコマンドパレットだけを変更する。
ただし内部では `openFeedLanding(feedId)` のような共通 intent を導入し、次の責務を 1 箇所に集約する。

1. feed を選択する
2. 最新 article を決める
3. 実効表示モードを解決する
4. reader / browser のどちらへ着地するか決める

この intent は初回実装ではコマンドパレットからだけ呼ぶ。
将来 Codex からアプリ操作を入れたい場合も、入口だけ差し替えて同じ intent を再利用する。

## Frontend Design

### New Intent Layer

新しい landing intent は hook または薄い service として追加する。

候補:

- `src/hooks/use-feed-landing.ts`
- 必要に応じて純粋関数を `src/lib/feed-landing.ts` へ分離

責務:

- `feedId` を受け取る
- feed metadata と article list を参照する
- `useUiStore` の action 群を順序どおり呼ぶ

### Data Sources

- feed metadata:
  - `useFeeds(selectedAccountId)` と同じ query/cache を利用
- feed articles:
  - `listArticles(feedId)` と同じ query key / fetcher を利用
  - すでに cache があれば再利用し、無ければ既存 command を通じて取得する

実装では article list とズレないよう、可能な限り既存の query key と既存の選別ロジックを再利用する。

### Existing Helpers To Reuse

- `src/lib/article-view.ts`
  - `resolveEffectiveDisplayMode()`
- `src/lib/article-list.ts`
  - 並び順の解決に使っている規則
  - 必要なら sort 部分を再利用しやすい pure helper に寄せる

### Store Actions

landing intent は既存 store action を組み合わせて状態を進める。

- `selectFeed(feedId)`
- `selectArticle(articleId)`
- `openBrowser(url)` または `closeBrowser()`

順序の意図:

1. `selectFeed(feedId)` で selection と周辺 state をリセット
2. 最新記事があれば `selectArticle(articleId)`
3. `widescreen` かつ URL ありなら `openBrowser(url)`

`selectArticle()` が `contentMode = "reader"` を設定し、その後に `openBrowser()` が `contentMode = "browser"` を上書きする流れは既存 state 設計と整合する。

## Command Palette Changes

### `src/components/reader/command-palette.tsx`

- 現在の `handleFeedSelect(feedId)` は `selectFeed(feedId)` を直接呼んでいる
- これを landing intent 呼び出しへ置き換える
- article / tag / action の既存挙動は変えない

### Labeling

MVP では結果行 UI を大きく増やさない。
既存の feed 行をそのまま使い、Enter 時の意味だけを「latest landing」に変える。

ただし将来混乱が出る場合に備え、次の拡張余地を残す。

- subtitle 追加
- `Open latest: <feed>` のような明示ラベル
- tooltip や help hint の追加

## Failure Handling

### Feed Not Found

- 指定 `feedId` が現在の account の feed 一覧に存在しない場合:
  - 何もしない
  - 必要なら短い toast を出す

### No Articles

- article list が空なら `selectFeed(feedId)` だけで止める
- browser view は開かない

### Missing URL

- 最新記事に `url` が無い場合:
  - `widescreen` でも reader 着地へフォールバックする

### Fetch Failure

- article fetch に失敗した場合:
  - feed selection だけは維持する
  - 自動 article open はスキップする
  - console / toast で診断可能にする

## Testing

### Unit / Integration Targets

- command palette で feed を選ぶと landing intent が呼ばれる
- `normal` feed では最新記事が選択され、reader 着地になる
- `widescreen` feed では最新記事が選択され、browser view に着地する
- feed に記事が無い場合は article を自動選択しない
- 最新記事に URL が無い widescreen feed では reader 着地にフォールバックする
- latest 判定が article list の先頭と一致する

### Suggested Files

- `src/__tests__/components/command-palette.test.tsx`
- `src/__tests__/hooks/use-feed-landing.test.tsx`
- 必要なら pure helper 用 test

## Documentation

実装が完了したら使い方ドキュメントも更新する。

最小要件:

- `README.md` にコマンドパレットから購読の最新へ着地できることを短く追記
- 必要なら `docs/` に操作例を追加

含める内容:

- `@` で購読検索
- Enter で最新へ着地
- `3ペイン` と `ワイドスクリーン` で着地先が変わること
- 記事が無い feed では一覧までで止まること

## Future Extension Boundary

この変更で作る intent は将来の自動操作入口の基盤として使う。
ただし初回実装ではその入口自体は追加しない。

将来候補:

- dev-only deep link
- Tauri command
- CLI 起動パラメータ
- Codex からの自動操作フック

いずれの場合も、「入口 -> `openFeedLanding(feedId)`」の形にし、landing の本体ロジックは再実装しない。

## Implementation Summary

この変更は新機能というより、「feed を選ぶ」操作を「見たい場所へ一段深く着地する」操作へ進化させる小さな UX 改善である。

- 表の変更点はコマンドパレットだけ
- 実装の核は共通 landing intent
- 表示モードの precedence と article list の並び順は既存ロジックを守る
- 将来の Codex / CLI 連携は、この intent の上に入口を載せるだけで拡張できる
