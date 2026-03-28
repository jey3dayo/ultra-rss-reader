# Inoreader Integration — Design Specification

## Overview

Inoreader プロバイダを追加し、Inoreader アカウントのフィード同期を実現する。
Inoreader は Google Reader API 互換のため、FreshRSS プロバイダをベースに実装。

## 前提条件

- `ProviderKind::Inoreader` は既に domain/provider.rs に定義済み
- `run_full_sync` に Inoreader のプレースホルダー（warn ログ）が存在
- FreshRSS プロバイダが Google Reader API の実装パターンを提供

## 認証

Inoreader は OAuth2 を使用。ただしMVPでは **API Token (AppID/AppKey + パスワード認証)** で実装する。

```http
POST https://www.inoreader.com/accounts/ClientLogin
Content-Type: application/x-www-form-urlencoded

Email={email}&Passwd={password}
```

レスポンスから `Auth=` トークンを取得し、以降のリクエストに `Authorization: GoogleLogin auth={token}` ヘッダーを付与。

FreshRSS と同じ認証フローだが、ベースURLが異なる。

## API エンドポイント

ベースURL: `https://www.inoreader.com/reader/api/0/`

| 操作         | エンドポイント                                                        |
| ------------ | --------------------------------------------------------------------- |
| 認証         | `POST /accounts/ClientLogin`                                          |
| フォルダ一覧 | `GET /tag/list?output=json`                                           |
| 購読一覧     | `GET /subscription/list?output=json`                                  |
| 記事取得     | `GET /stream/contents/{stream_id}?output=json&n=50`                   |
| 既読ID一覧   | `GET /stream/items/ids?output=json&s=user/-/state/com.google/read`    |
| スターID一覧 | `GET /stream/items/ids?output=json&s=user/-/state/com.google/starred` |
| 既読マーク   | `POST /edit-tag?a=user/-/state/com.google/read&i={entry_id}`          |
| スターマーク | `POST /edit-tag?a=user/-/state/com.google/starred&i={entry_id}`       |

これらは FreshRSS と同一のエンドポイントパス。

## 実装方針

### 案1: InoreaderProvider を新規作成（FreshRSS コピー + URL変更）

- メリット: 独立、将来の Inoreader 固有機能に対応しやすい
- デメリット: 大量のコード重複

### 案2: GReaderProvider を汎用化（推奨）

- FreshRSSProvider を `GReaderProvider` にリネーム/リファクタ
- ベースURLをコンストラクタ引数にする
- Inoreader / FreshRSS 両方で同じ実装を使う
- メリット: DRY、保守性が高い
- デメリット: 既存 FreshRSS コードの変更が必要

### 推奨: 案2

## 変更計画

### Phase 1: GReaderProvider リファクタ

1. `freshrss.rs` → `greader.rs` にリネーム
2. `FreshRssProvider` → `GReaderProvider` にリネーム
3. コンストラクタを `new(base_url: &str, kind: ProviderKind)` に変更
4. `kind()` メソッドがコンストラクタ引数を返すように
5. 認証URLのベースも引数から導出
6. FreshRSS 固有のコードがあれば条件分岐

### Phase 2: Inoreader 対応

1. `run_full_sync` のプレースホルダーを実装
2. `sync_inoreader_account` を追加（`sync_freshrss_account` と同パターン、GReaderProvider のベースURLを Inoreader に設定）
3. UI: AddAccountForm に "Inoreader" 選択肢を追加
4. Inoreader はサーバーURLが固定（`https://www.inoreader.com`）なのでサーバーURL入力は不要
5. モックデータに Inoreader アカウントを追加

### Phase 3: テスト

1. GReaderProvider のユニットテスト（mockito でモックサーバー）
2. 既存 FreshRSS テストが引き続きパスすることを確認

## UI 変更

### AddAccountForm

- Type ドロップダウンに "Inoreader" を追加
- Inoreader 選択時: Email + Password フィールドを表示（サーバーURL不要）
- FreshRSS 選択時: 既存のまま（サーバーURL + Username + Password）

### アカウント詳細

- Type 表示: "Inoreader"
- サーバーURL: "inoreader.com"（固定表示）

## ファイル変更一覧

| ファイル                                                  | 変更                            |
| --------------------------------------------------------- | ------------------------------- |
| `src-tauri/src/infra/provider/freshrss.rs` → `greader.rs` | リネーム + 汎用化               |
| `src-tauri/src/infra/provider/mod.rs`                     | モジュール名変更                |
| `src-tauri/src/commands/feed_commands.rs`                 | Inoreader sync 実装             |
| `src-tauri/src/commands/account_commands.rs`              | Inoreader アカウント作成対応    |
| `src/components/settings/add-account-form.tsx`            | UI に Inoreader 選択肢追加      |
| `src/dev-mock-data.ts`                                    | モック Inoreader アカウント追加 |
| `src/dev-mocks.ts`                                        | モックハンドラ更新              |
