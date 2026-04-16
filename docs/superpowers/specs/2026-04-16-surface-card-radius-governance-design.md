# Surface Card Radius Governance Design

## Goal

角丸のブレを「値の調整」ではなく「役割ごとの共通 surface 管理」で抑える。
今回の対象は `情報カード` と `セクション箱` に限定し、かなり丸い直書き radius を shared primitive に集約して、UI モックと実装の両方で同じ基準を使える状態にする。

## Non-Goals

- dialog / modal shell / command palette の全面再設計
- 既存のすべての `rounded-*` を一度に置き換えること
- 色、タイポグラフィ、余白体系の全面見直し
- 記事表示や settings の挙動変更
- feature ごとの情報設計や state model の変更

## Current Problem

- `DESIGN.md` には radius scale があるが、実装側に `rounded-[22px]` `rounded-[24px]` `rounded-[28px]` `rounded-[32px]` の直書きが残っている
- 同じ「読むための箱」でも component ごとに radius / border / shadow / padding の組み合わせがずれている
- `DESIGN_REVIEW.md` では `DESIGN.md` → `shared` → feature-local の順で揃える方針だが、surface 系は shared に十分上がっていない
- Storybook に参照キャンバスはあるが、surface role ごとの基準見本が明示されていない
- その結果、「もっと角角にしたい」という調整が token 修正ではなく個別コンポーネント修正になりやすい

## Approved Direction

採用方針は `情報カード + セクション箱` を対象にした shared primitive 化とする。

- `情報カード` は `6px family` を標準とする
- `セクション箱` は `8px family` を標準とする
- `20px` を超える radius はこの 2 role では禁止する
- radius だけでなく、surface / border / shadow / padding も semantic role として shared 側に寄せる
- feature 側は `見た目の値` ではなく `役割` を選ぶ構造にする
- dialog / modal shell など大きな外枠は別 role 候補として残すが、今回の shared primitive には混ぜない

## Design Rules

### Role Definition

#### 情報カード

読む、案内する、状態を伝えるための箱。
empty state、notice、summary、補助説明の box が対象。

- 標準 radius: `6px family`
- 視覚トーン: 情報密度を支える軽い border と surface
- 主用途: 読み物、補助説明、状態表示

#### セクション箱

画面の主要な構造単位を作る箱。
settings section、overview panel の外枠、画面内の主要 container が対象。

- 標準 radius: `8px family`
- 視覚トーン: 情報カードよりやや構造感を持たせる
- 主用途: 画面構造、情報グルーピング、レイアウト区切り

### Radius Governance

- `情報カード` と `セクション箱` では `rounded-[...]` のピクセル直書きを避ける
- shared primitive 利用箇所では `className` からの radius 上書きを原則禁止とする
- 大きい角丸が必要な場合は「例外」ではなく「別 role」を検討する
- `DESIGN.md` では数値 scale だけでなく、role ごとの標準 radius と禁止事項を明記する

### Shared Primitive Contract

shared primitive は仮に `SurfaceCard` とする。

- `variant`: `info | section`
- `tone`: `default | subtle | emphasis | success | danger`
- `padding`: `compact | default | spacious`
- `className`: layout 拡張のみ許可し、radius を変える用途には使わない

この primitive の責務は以下に限定する。

- radius
- border
- background surface
- elevation
- padding

逆に以下は呼び出し側に残す。

- 情報の並び順
- 見出しの有無
- 内部レイアウト
- feature 固有の interaction

## Storybook and Mock Integration

モックの基準面は `UI Reference / View Specimens Canvas` に寄せる。
単体 story だけではなく、参照キャンバスに role 見本を置くことで、review 時に「この箱は info か section か」を比較できるようにする。

- `ArticleEmptyStateView` story は `info` surface の代表として扱う
- `SettingsSection` は `section` surface の代表として扱う
- `UI Reference / View Specimens Canvas` に `info` と `section` の基準見本を置く
- 将来の画面追加時は、まずこの参照キャンバスで role を確認し、必要なら `DESIGN.md` / shared primitive を更新する

これにより、モック、review、実装が同じ基準面を共有できる。

## Initial Component Scope

初回の差し替えは代表 2 箇所に限定する。

- `src/components/reader/article-empty-state-view.tsx`
- `src/components/settings/settings-section.tsx`

この 2 箇所で API と見た目の妥当性を確認したうえで、次の候補へ展開する。

次点候補:

- `src/components/feed-cleanup/feed-cleanup-card.tsx`
- `src/components/feed-cleanup/feed-cleanup-overview-panel.tsx`
- `src/components/shared/feed-detail-panel.tsx`

## Implementation Outline

1. `DESIGN.md` に role と radius governance を追記する
2. `src/components/shared` に `SurfaceCard` を追加する
3. `ArticleEmptyStateView` を `variant="info"` に移行する
4. `SettingsSection` を `variant="section"` に移行する
5. Storybook の参照キャンバスに role 見本を追加する
6. 既存テストを shared primitive 前提で更新する

## Risks

1. shared primitive を作っても `className` で見た目が再び崩れる
対応:
radius の上書きを運用上禁止し、必要なら別 role か feature-local 例外として切り分ける

2. `情報カード` と `セクション箱` の境界が曖昧で、逆に使い分けがぶれる
対応:
`DESIGN.md` と Storybook に代表例を明記し、review 時は semantic role で判断する

3. 初回対象を広げすぎて、モーダルや overlay まで巻き込む
対応:
今回は `情報カード + セクション箱` に限定し、大きな shell は別フェーズに分離する

## Validation

- `DESIGN.md` に `情報カード` と `セクション箱` の role 定義が追加されている
- shared primitive から `info` と `section` を選べる
- `ArticleEmptyStateView` の過剰な丸みが shared role の標準値に置き換わっている
- `SettingsSection` が shared role を使い、独自の大きな radius 直書きから離れている
- `UI Reference / View Specimens Canvas` に role 見本が置かれている
- 新規 UI review で `DESIGN.md` → `shared` → `feature-local` の判断がしやすくなっている
- 最終的に `mise run check` を通す
