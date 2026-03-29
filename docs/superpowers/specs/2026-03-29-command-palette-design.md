# Command Palette Design

## Overview

Ultra RSS Reader にコマンドパレット（⌘K）を実装する。アクション・フィード・記事を統合検索し、キーボードから素早く操作できるようにする。

## Requirements

- ⌘K / Ctrl+K でパレットを開閉
- 統合検索: アクション（32 AppActions）、フィード、記事タイトルを横断検索
- プレフィックスフィルタ: `>` アクション、`@` フィード、`#` タグ
- 記事検索はローカル優先、300ms debounce で FreshRSS API にも問い合わせ
- 初期表示: 最近のアクション履歴（localStorage、最大 10 件）
- Light / Dark テーマ両対応（既存 CSS カラートークン使用）
- i18n 対応（ja / en）

## Approach

cmdk ライブラリ + 既存 Base UI Dialog パターン。mock/components/ui/command.tsx を移植・拡張。

注意: mock の command.tsx は Radix UI Dialog をインポートしているが、プロジェクトは `@base-ui/react` を使用。移植時に `src/components/ui/dialog.tsx`（Base UI ベース）に合わせて書き換えが必要。

## Architecture

### New Files

| File                                        | Purpose                                              |
| ------------------------------------------- | ---------------------------------------------------- |
| `src/components/ui/command.tsx`             | cmdk ラッパー（mock から移植）                       |
| `src/components/reader/command-palette.tsx` | パレット本体。グループ表示・プレフィックス対応       |
| `src/hooks/use-command-search.ts`           | 検索ロジック。プレフィックス解析 + ローカル/API 検索 |
| `src/hooks/use-command-history.ts`          | 最近のアクション履歴（localStorage）                 |

### Modified Files

| File                                  | Change                                                                |
| ------------------------------------- | --------------------------------------------------------------------- |
| `src/stores/ui-store.ts`              | `commandPaletteOpen` 状態追加                                         |
| `src/hooks/use-keyboard.ts`           | ⌘K ショートカット追加                                                 |
| `src/components/reader/app-shell.tsx` | `<CommandPalette />` 配置                                             |
| `src/locales/*/reader.json`           | コマンド名の i18n 文字列（既存 shortcuts セクションと同一 namespace） |
| `src/lib/actions.ts`                  | `open-command-palette` アクション追加                                 |

### Data Flow

1. ⌘K → UI Store が `commandPaletteOpen = true`
2. ユーザー入力 → `useCommandSearch` がプレフィックス解析 + 検索実行
3. 結果がグループ別に表示（アクション → フィード → 記事）
4. 選択 → `executeAction()` / フィード選択 / 記事選択

## Search Logic

### Prefix Routing

| Prefix | Target       | Source                     |
| ------ | ------------ | -------------------------- |
| (none) | All          | Actions + Feeds + Articles |
| `>`    | Actions only | AppAction static list      |
| `@`    | Feeds only   | React Query cache          |
| `#`    | Tags only    | React Query cache          |

### Search Sources

- Actions: 静的リスト（32 個）を i18n 表示名で cmdk ビルトインファジー検索
- Feeds: React Query の `useFeeds()` キャッシュ。タイトル + URL でマッチ
- Articles (local): 既存の `useSearchArticles(accountId, query)` フック → FTS5 + LIKE ハイブリッド
- Articles (provider): 300ms debounce で FreshRSS API に問い合わせ、「オンライン結果」グループに追加

### Performance

- アクション・フィード・タグ: 同期的（メモリ上のデータ）
- 記事ローカル: `useDeferredValue` で UI をブロックしない
- 記事プロバイダー: 300ms debounce + 非同期、ローディングスピナー表示

## Rust Backend

### Article Search (既存 — 変更不要)

記事検索は全レイヤーで**実装済み**。新規追加は不要。

| Layer            | Existing Implementation                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Repository trait | `ArticleRepository::search(account_id, query, pagination) -> DomainResult<Vec<Article>>` |
| SQLite impl      | FTS5 + LIKE ハイブリッド検索（CJK 混合対応）、重複排除、ページネーション付き             |
| Command          | `#[tauri::command] search_articles(account_id, query, offset, limit)`                    |
| TS API           | `searchArticles(accountId, query, offset?, limit?)` in `tauri-commands.ts`               |
| Hook             | `useSearchArticles(accountId, query)` in `use-articles.ts`                               |

コマンドパレットからはこの既存 `useSearchArticles` フックをそのまま利用する。

## UI Design

### Component: CommandPalette

- cmdk の `CommandDialog` をベースに構築
- 3 つの状態: 初期表示（履歴）→ 全検索（グループ別）→ プレフィックスフィルタ

### Styling

ハードコードした色は使わない。既存 CSS カラートークンのみ:

| Usage         | Tailwind Class            |
| ------------- | ------------------------- |
| Background    | `bg-popover`              |
| Text          | `text-popover-foreground` |
| Selected item | `bg-accent`               |
| Border        | `border-border`           |
| Muted text    | `text-muted-foreground`   |
| Highlight     | `text-primary`            |

### Keyboard

| Key               | Action                           |
| ----------------- | -------------------------------- |
| ⌘K / Ctrl+K       | Toggle palette                   |
| Escape            | Close palette                    |
| ↑ / ↓             | Navigate results (cmdk built-in) |
| Enter             | Execute selected                 |
| Backspace (empty) | Remove prefix badge              |

## History

- `useCommandHistory` hook
- localStorage に最近実行したアクション ID を最大 10 件保存
- パレット初期表示時に読み出し
- アクション/フィード/記事の選択時に履歴を更新

## Dependencies

- `cmdk` (~8KB gzip) — 新規追加

## Out of Scope

- 記事本文の全文検索（タイトルのみ）
- カスタムショートカットの割り当て変更
- パレットからの新規フィード追加
