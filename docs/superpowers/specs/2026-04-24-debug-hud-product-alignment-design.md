# Debug HUD Product Alignment Design

## Summary

focus debug HUD を、
「開発ツールの別UI」ではなく
「プロダクトの中に差し込まれた透明な診断レイヤー」
として見えるように調整する。

採用方針は次の通り。

- 透明感とオーバーレイらしさは維持する
- `More` / `Copy` は HUD 専用ボタンをやめ、プロダクトで使っている shared button 文法に寄せる
- 情報構成は全面刷新しない
- ただし、上から `pane/mode`、`focused element`、`recent events` の順に
  軽く整理して読みやすさを上げる
- `closing` / `pending` などの technical な raw 情報は残す

これにより、debug HUD の「浮いた別製品感」を減らしつつ、
診断用の生々しさと半透明の存在感は残す。

## Current State

- `FocusDebugHudView` は HUD 専用の button / card / chip 風の見た目を
  その場で組み立てている
- 外枠、内側カード、pill、button がそれぞれ別の角丸と別の surface grammar を持ち、
  プロダクト本体の settings / reader / modal より HUD 専用UIに見えやすい
- `More` / `Copy` は shared button ではなく、
  `border-white/12 bg-white/[0.03] rounded-lg` 系の独自文法になっている
- 情報の順序は今でも成立しているが、
  `pane=list mode=empty`、active element、trace が同じ密度で並び、
  最初の視線誘導が弱い
- 一方で、半透明の黒ガラス感やモノスペースの technical tone そのものは
  HUD として機能しており、完全に消すべきではない

## Goals

- debug HUD のボタンを product UI と同じ family に揃える
- HUD 全体の角丸、border、surface tone を整理して
  「別製品の widget」感を下げる
- 情報の優先順位を少しだけ整え、
  最初に読む場所を明確にする
- 技術情報量は維持しつつ、可読性を上げる
- shared primitive へ寄せられるところは寄せ、
  feature-local の見た目組み立てを減らす

## Non-Goals

- debug HUD を通常ユーザー向け UI に変えること
- HUD を完全な card UI や settings panel の見た目に寄せ切ること
- 表示する診断データの種類を大幅に増減すること
- debug HUD の機能追加や state 管理の見直しを行うこと
- 透明感を捨てて不透明な panel にすること

## UX Decisions

### 1. Visual Direction

方向性は `見た目をかなり整えるが、情報整理は最小限` にする。

具体的には次を守る。

- HUD の黒ガラス感は残す
- backdrop blur も維持する
- ただし border と surface の強さを product UI 側へ少し寄せる
- 角丸は product shell と衝突しない範囲で整理する

目指す印象は
`透明な開発HUD`
であって、
`サイバー風の独立ツール`
ではない。

### 2. Buttons

`More` / `Copy` / `Show` / `Hide` は
HUD 専用ボタンをやめて shared button 文法へ寄せる。

ただし、そのまま通常 button を置くと HUD の透明感を壊しやすいので、
次のレベル感にする。

- ベースは product の muted action family
- `rounded-md`
- 高さは settings / shared action と揃う touch-safe サイズ
- hover は強い白 border 強調ではなく、穏やかな tone shift
- text / icon は白ベースではなく、
  HUD 背景に合わせた半透明 foreground で始める

つまり、component family は shared に揃え、
token の選び方だけ HUD 用に静かに調整する。

### 3. Information Hierarchy

現在の 3 ブロック構成は維持する。

- header
- focused element area
- trace / recent events area

ただし、header 直下の
`pane=list mode=empty`
は本文ではなく badge 的な扱いに寄せる。

理由:

- 現状は最初の 1 行が長い monospace テキストで、
  視線の止まりどころが弱い
- `pane` と `mode` は状態ラベルとして見た方が読みやすい

一方で、
`closing=false`
`pending=none`
のような raw state は残す。
これらは debug HUD の価値そのものなので、
削るより「一段弱い pill」にして混雑だけ抑える。

### 4. Scope Of Information Cleanup

情報整理は「少しだけ」に留める。

やること:

- block label を読みやすくする
- badge / pill の強弱を整理する
- event 群の見出しと本文の密度差をつける

やらないこと:

- 文章の意訳
- 状態名の rename
- debug 向け detail の削減
- trace を要約して別物にすること

## Architecture

### 1. `DebugHudFrame` は残す

HUD の shell role は引き続き `DebugHudFrame` に持たせる。

ただし variant の責務をはっきりさせる。

- panelCollapsed
- panelExpanded
- strip
- stripCompact

ここでは HUD 外枠の surface / radius / blur / border を管理し、
feature-local component で ad hoc に shell 見た目を積まない。

### 2. Shared Buttons を使う

`More` / `Copy` / `Show` / `Hide` の button 群は
feature-local の class 直書きを減らし、
shared button か、
必要なら HUD 向けの薄い adapter を作って揃える。

優先順位:

1. 既存 shared button を直接使えるなら使う
2. 無理なら `DebugHudActionButton` のような薄い wrapper を作る
3. wrapper の責務は HUD 向け tone の選択だけに留める

button の role そのものは shared に寄せ、
HUD 側では余白や layout だけを見る。

### 3. `FocusDebugHudView` は情報配置だけ持つ

`FocusDebugHudView` の責務は次に限定する。

- expanded / collapsed の state
- どの block を出すか
- 文言と診断データの配置

ボタンの look-and-feel や shell の見た目は、
できるだけ shared primitive / `DebugHudFrame` 側に逃がす。

## Mock Decision

比較 mock のうち、
`Option 2` をベースにしつつ、
整理の強さは少し弱める。

採用するのは次の中間案。

- 見た目はかなり product 寄せ
- 情報整理は軽め
- 透明感は保持
- technical tone は保持

## Implementation Notes

- `Debug HUD` の label typography は残してよいが、
  white/48 系の生値が多すぎる場合は token 化や集約を検討する
- `More` / `Copy` / `Show` / `Hide` は shared button family に寄せる
- `pane` / `mode` は badge 化してもよい
- `closing` / `pending` は pill のまま残す
- inner cards の radius は shell との差を少し詰める
- hover / focus は white border 強調より tone shift 優先にする
- Storybook / test があるなら、見た目契約の更新も合わせて行う

## Acceptance Criteria

- debug HUD が透明な overlay としては残る
- `More` / `Copy` / `Show` / `Hide` が product UI の button family と揃って見える
- 外枠と内側 card の角丸・surface・border が整理されている
- `pane` / `mode` の読み出しが今よりしやすい
- `closing` / `pending` と recent events は引き続き見える
- HUD が「別製品の widget」ではなく、
  Ultra RSS Reader の一部として見える

## Open Questions Resolved

- 透明感は維持する
- shared button を使う方向で調整する
- 情報構成は全面刷新せず、少しだけ整理する
- 採用案は mock の `2寄り` だが、整理の強さは中間に留める
