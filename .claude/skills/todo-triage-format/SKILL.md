---
name: todo-triage-format
description: "Use when writing an entry in this repository's `TODO.md` or running `scripts/todo-triage.ts`. Lifecycle rules (what belongs in TODO vs CHANGELOG, when to move, CHANGELOG entry style) live in the `todo-changelog-ops` skill; this skill covers only the machine-readable format and the triage commands."
version: 1.0.0
tags: [todo, triage, parser]
triggers:
  - TODO triage
  - todo-triage
  - TODO 書式
---

# TODO Triage Format

このリポジトリの `TODO.md` は `scripts/todo-triage.ts` の入力を兼ねる。ライフサイクルは `todo-changelog-ops` が正本で、ここはパーサ契約だけを扱う。

判断基準の owner:

| 判断                                                               | Owner                                                 |
| ------------------------------------------------------------------ | ----------------------------------------------------- |
| P0-P3 taxonomy、aging 閾値、`created batch` / `last reviewed` 運用 | `.claude/rules/quality-policy.md`                     |
| intake stop rules、domain shard、並列投入の可否                    | `TODO.md` 冒頭セクション                              |
| TODO / CHANGELOG の役割分担と移動タイミング                        | `todo-changelog-ops` skill、`CLAUDE.md` Task Tracking |
| `[Unreleased]` をバージョン節へ切り出す                            | `release` skill、`.claude/rules/release-workflow.md`  |

## Entry format

`scripts/todo-triage.ts` は次の形しか認識しない。1 つでも外すとその項目は triage 出力から丸ごと落ちる。

```markdown
- [ ] P1 provider auth failure storm を止める
  - 対象: `src-tauri/src/infra/provider`, `src-tauri/src/service/sync_scheduler.rs`
  - 検証: provider Rust tests、manual native verification
  - created batch: 2026-07-28 wave
```

- タイトル行は checkbox 付き (`- [ ]`) で始め、直後を `P0`-`P3`（任意で `-CODE`、例 `P1-Q3`）にする。
- detail は半角スペース 2 個インデントの `- key: value`。**1 行 1 キー**にする。`priority: P3 / domain: reader-state / ...` のような複合行は先頭キーだけが読まれ、残りは値へ埋没する。
- 認識されるキー: `対象`(=`target`) / `検証`(=`verification`) / `完了条件`(=`acceptance`) / `defer` / `domain shard` / `親バッチ` / `背景` / `shard` / `worker prompt` / `created batch`(=`created`) / `last reviewed`(=`reviewed`) / `supersedes` / `superseded by` / `completed by`。大文字小文字は無視、全角コロンも可。
- `domain shard:` に既知の domain（`TODO.md` 冒頭の一覧）を書くと、見出しやパスからの推論より優先される。未知の値を書いた場合は推論へフォールバックする。
- 値のパス・識別子はバッククォートで囲む。`対象` は inline code があればそれだけを、無ければ `、` `,` `;` 区切りのうちパス様の要素を拾う。
- `検証` の値に `manual` / `native` / `手動` / `目視` を含めると manual verification として分離される。
- 上記以外のキー（`priority`、`work type`、`write scope`、`focused verification`、`acceptance criteria`、`発見方法`、`blocked`、`残` など）は `rawDetails` に残るだけで構造化されない。散文で補う場合は認識キーの値側か、インデントした素の箇条書きに置く。

追加したら `node scripts/todo-triage.ts json TODO.md` を実行し、その項目が `items` に現れ `targetFiles` と `focusedVerification` が空でないことを確認する。

## Triage コマンド

`node scripts/todo-triage.ts <command> TODO.md`。

| command                     | 用途                                                                      |
| --------------------------- | ------------------------------------------------------------------------- |
| `json`                      | 全項目の構造化ダンプ。書式検証にも使う                                    |
| `duplicates`                | 類似 TODO のグルーピングと merge 方針                                     |
| `shards`                    | domain owner 別 shard と write scope 衝突の確認。並列バッチを組む前に使う |
| `aging`                     | `created batch` / `last reviewed` からの経過と stale 判定                 |
| `export-md` / `export-json` | worker prompt / issue 用エクスポート                                      |

## 検証

`TODO.md` のみを変更したときは full gate を回さず、`node scripts/todo-triage.ts json TODO.md` が例外なく完走することと、`git diff --check` を確認する。パーサ自体（`scripts/todo-triage.ts`）を変更したときは `tests/todo-triage.test.ts` と `src/__tests__/scripts/todo-triage.test.ts` の両方を実行する。
