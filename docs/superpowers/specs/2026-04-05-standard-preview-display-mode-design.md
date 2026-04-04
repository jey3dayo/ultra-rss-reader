# Standard/Preview Display Mode Design

## Summary

記事表示モードを user-facing では `標準` / `プレビュー` の 2 択へ整理する。
現状の `reader_and_preview` と `preview_only` は、プレビュー表示中の見た目が同一で、
ユーザーに差が伝わらないため統合する。

## Decision

- user-facing preset は `standard` / `preview` の 2 つにする
- `standard` は `readerMode=true`, `webPreviewMode=false` を意味する
- `preview` は UI 上の既定として `readerMode=true`, `webPreviewMode=true` を意味する
- 既存データの `readerMode=false`, `webPreviewMode=true` は legacy 状態として許容しつつ、
  UI 上では `preview` として扱う

## Rationale

- `記事 + プレビュー` と `プレビューのみ` は、現在の全面 overlay UI では見た目が同じ
- `記事のみ` は `のみ` が排他的に響くため、`標準` に置き換える
- `preview` 選択時も reader を内部的に残しておくと、埋め込み不可時の fallback を自然に維持できる

## Scope

- `src/lib/article-display.ts` の preset モデルを 2 択へ更新
- reader/settings/feed surfaces の選択肢・表示文言を `標準` / `プレビュー` に更新
- 旧 3 モード前提のテストと Storybook サンプルを追従

## Non-Goals

- DB schema や永続化カラムの再設計
- `reader_mode` / `web_preview_mode` の削除
- overlay レイアウト自体の再設計
