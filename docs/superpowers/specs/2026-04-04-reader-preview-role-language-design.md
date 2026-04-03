# Reader/Preview Role And Language Alignment Design

## Summary

進行中の差分では、記事表示の見せ方が従来の `normal / widescreen` から、`reader / preview` の 2 軸と
`reader_only / reader_and_preview / preview_only` の preset へ寄り始めている。

この spec では、その新しい命名に合わせてツールバー・ネイティブメニューバー・翻訳文言の責務を整理する。
目的は UI の骨格を大きく変えずに、以下の 2 点を解消すること。

- ツールバーとメニューバーの役割が曖昧なまま、古い `browser` / `reader` / `display mode` の語彙が混ざっている
- `ja` UI でも preset 名やメニュー、toast、empty state に英語や旧語彙が残り、画面内で言語が混在して見える

## Goals

- 進行中の `reader / preview` モデルを、記事 UI とメニュー文言の正本として扱う
- メニューバー構成は基本維持しつつ、役割を `全体操作` 側へ寄せる
- 記事ツールバーと preview overlay の責務を分離し、`何を閉じるのか` が分かる文言に揃える
- `preferences.language` を source of truth とし、アプリ内 UI とネイティブメニューバーで同じ解決言語を使う
- touched surface に残っている user-visible な直書き文言を翻訳キーへ寄せる

## Non-Goals

- メニューバー階層そのものの再設計
- 3 ペイン / mobile layout / overlay animation など、大きなレイアウト変更
- 内部 action id や shortcut id の全面 rename
- `en` / `ja` 以外の言語追加
- `reader / preview` の永続化方式自体の再設計

## Current State

### Reader/Preview Model Is Already Emerging

- `src/lib/article-display.ts` で、`reader_only` / `reader_and_preview` / `preview_only` が導入されている
- `src/components/reader/article-view.tsx` では、`DisplayModeToggleGroup` を記事ツールバーに載せて
  `readerMode` と `webPreviewMode` を一時 override する方向へ寄っている
- つまり、今回の整理は新しい model を作るのではなく、既に乗り始めている model に UI copy と責務を追従させる作業になる

### User-Facing Terms Are Still Mixed

- `src/locales/ja/reader.json` と `src/locales/ja/settings.json` では、新しい preset key がまだ `Reader only` など英語のまま
- `src/components/reader/article-toolbar-view.tsx` と `src/components/reader/article-view.tsx` では、
  in-app preview と external browser の区別が、ラベル上はまだ十分に明確ではない
- `src-tauri/src/menu.rs` ではネイティブメニューが英語ハードコードで、かつ旧来の `Reader` / `Browser` 表現が残っている

### Some Strings Ignore i18n Entirely

- `src/lib/actions.ts` の sync toast
- `src/components/reader/article-view.tsx` の `Link copied`, `Added to Reading List`, `Article not found`
- `src/components/app-shell.tsx` の toast dismiss label

このため、設定で日本語を選んでも、主要画面の中で英語と日本語が混在する。

### Internal IDs And Displayed Meaning Are Not Perfectly Aligned

- menu / action wiring には legacy な id が残っており、表示ラベルと内部 id が 1 対 1 では説明しづらい箇所がある
- 今回は internal id を rename せず、`表示名は実際の挙動に合わせる` 方針を採る

## Design

### Terminology Model

以後の user-facing 用語は以下で固定する。

- `Reader`: 右ペインで表示する記事本文
- `Preview`: アプリ内の Web preview
- `External browser`: OS の外部ブラウザ

preset 名は内部では現行どおり `reader_only` / `reader_and_preview` / `preview_only` を維持する。
ただし表示ラベルは各 locale で自然な言葉に直す。

推奨 copy:

- en
  - `Reader only`
  - `Reader + Preview`
  - `Preview only`
- ja
  - `記事のみ`
  - `記事 + プレビュー`
  - `プレビューのみ`

`ja` では raw な英語 `Reader only` を残さない。
また、操作ラベルでは `Preview` だけだと外部ブラウザと競合しやすいため、verb を伴う箇所では `Webプレビュー` を使ってよい。

### Responsibility Boundaries

#### Menu Bar

メニューバーは今の section 構成を概ね維持する。
役割は以下に限定する。

- 全体機能の発見性
- shortcut の補助表示
- OS ネイティブな操作入口

記事文脈に依存する item を残してもよいが、`今この UI が何を閉じるのか` を説明する責務は負わせない。
その責務は、目の前にある toolbar / overlay 側で表現する。

#### Sidebar Toolbar

サイドバー上部は、左ペイン全体に効く高頻度操作だけを置く。

- `同期`
- `フィードを追加`

設定や article-specific な操作は持ち込まない。

#### Article Toolbar

記事ツールバーは `選択中の記事` に対する即時操作へ絞る。

第一候補:

- `記事を閉じる`
- `既読/未読`
- `スター`
- `Webプレビュー`
- `外部ブラウザで開く`
- `共有` は必要なら menu に集約

進行中の diff で追加されている `reader / preview` preset control は、`全体の表示モード切替` ではなく
`選択中の記事の表示 surface をどう出すか` という local control として扱う。
そのため、記事ツールバーに置くこと自体は許容する。

#### Preview Overlay

overlay は preview surface であって、別の操作面にはしない。
overlay に常設する責務は以下のみとする。

- `Webプレビューを閉じる`

`記事を閉じる`、`既読/未読`、`スター`、`共有` は overlay 側へ複製しない。

### Close Semantics

close 系文言は、閉じる対象ごとに分ける。

- 記事 pane の close: `記事を閉じる`
- preview overlay の close: `Webプレビューを閉じる`

`ブラウザを閉じる` は、外部ブラウザまで閉じるように誤読されやすいため、in-app preview の close 文言としては使わない。

preview toggle button は pressed/unpressed に応じて stateful label を出せるならそれが望ましい。
ただし scope を広げたくない場合は、少なくとも generic な `Browser` 表記をやめ、neutral な `Webプレビュー` / `Toggle Web Preview`
へ寄せればよい。

### Language Source Of Truth

言語の source of truth は既存どおり persisted preference の `language` とする。

- `system`
- `ja`
- `en`

resolved language は frontend と Rust backend で同じ rule を使う。

- `system` のとき
  - OS locale が `ja` で始まれば `ja`
  - それ以外は `en`
- explicit `ja` / `en` はそのまま使う

frontend は現行どおり i18next を使う。
native menu は hardcoded string をやめ、resolved language に応じて同じ terminology set を参照して組み立てる。

### Native Menu I18n

`src-tauri/src/menu.rs` は英語 literal を直接持たない形へ寄せる。

要件:

- app 起動時に persisted `language` から resolved language を決定できる
- resolved language に応じて menu label を組み立てる
- `language` preference が runtime で変わったとき、native menu も同じ言語へ更新される

実装方法は planning で決めてよいが、以下は守る。

- Tauri / OS が所有する predefined item は今回の full localization 対象に含めない
  - 例: `About`, `Quit`, `Undo`, `Redo`, `Cut`, `Copy`, `Paste`, `Select All`
  - これらは native item のまま維持してよい
- 今回 i18n を揃える対象は app-owned な custom label に限定する
  - app submenu title
  - settings / update / filter / sync / subscription / item / share などの custom item
- user-facing menu copy を英語ハードコードへ戻さない
- frontend と backend で別々の terminology を持たない
- 旧来の `Open in Browser` が in-app preview を意味していた箇所は、新しい model に沿って re-label する

想定される menu copy の方向:

- in-app preview: `Open Web Preview`
- external browser: `Open in External Browser`

internal id が legacy なままでも、見えるラベルは実際の挙動で決める。

### Locale Resource Policy

touched surface の user-visible string は locale resource に寄せる。

最低限の対象:

- reader preset labels
- preview unavailable 文言
- sync toast
- copy/share toast
- article not found
- toast dismiss label
- native menu labels

特に `ja` locale では、新規の `reader / preview` key を英語のまま残さない。

## Testing

### Frontend

- `ja` と `en` の両方で、記事 toolbar / settings / toast に言語混在が残らないこと
- preview toggle / overlay close / article close が、それぞれ別の意味で表示されること
- `reader_only` / `reader_and_preview` / `preview_only` の表示ラベルが locale ごとに正しいこと
- preview unavailable の fallback 文言が locale に応じて出ること
- hardcoded 英語 toast を翻訳キー化したことで既存挙動が壊れないこと

### Native Menu

- 起動時の `language` preference が `ja` / `en` / `system` それぞれで期待どおりの menu label になること
- runtime で language を変更したとき、native menu が同じ resolved language へ更新されること
- menu item の配線自体は変わらず、既存 action が呼ばれること

### Interaction Semantics

- `記事を閉じる` は article selection を閉じるだけで、preview の close とは別動作であること
- `Webプレビューを閉じる` は preview surface だけを閉じ、記事 selection は維持すること
- in-app preview と external browser のラベルが逆転しないこと

## Risks

### Legacy IDs Can Still Be Misleading During Implementation

internal id が旧名のままだと、planning 中に `reader` / `browser` を取り違えやすい。
そのため、実装では `表示名は挙動で決める` 原則を先に固定する必要がある。

### Runtime Menu Rebuild

native menu を runtime で張り替えると、実装次第では一瞬 menu が再生成される。
ただし、language 変更後も menu だけ旧言語のまま残る方が UX 上の違和感は大きいため、即時反映を優先する。

### Partial Copy Migration

menu だけ、または toolbar だけ先に直すと、かえって terminology の混在が増える。
planning では touched surface をまとめて更新する順番を採るべきである。

## Implementation Targets

- `src-tauri/src/menu.rs`
- `src/lib/actions.ts`
- `src/components/reader/article-toolbar-view.tsx`
- `src/components/reader/article-view.tsx`
- `src/components/reader/browser-view.tsx`
- `src/components/reader/display-mode-toggle-group.tsx`
- `src/components/app-shell.tsx`
- `src/locales/en/reader.json`
- `src/locales/ja/reader.json`
- `src/locales/en/settings.json`
- `src/locales/ja/settings.json`
- menu copy を持つ Rust 側の helper 追加が必要ならその新規ファイル
- 関連テスト
