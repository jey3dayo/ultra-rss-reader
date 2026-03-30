# FreshRSS 接続検証 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: FreshRSS/Inoreader アカウント追加時に、保存前に接続テスト（authenticate）を実行し、成功時のみ保存する。失敗時は段階的エラーメッセージを表示する。

Architecture: 既存の `add_account` Tauri コマンドを `pub fn` → `pub async fn` に変更し、`GReaderProvider::authenticate()` を DB 保存前に呼び出す。フロントエンドは保存ボタンにスピナーを表示し、Rust 側で組み立てたエラーメッセージをトーストで表示する。

Tech Stack: Tauri 2 (Rust), React 19, TypeScript, reqwest, i18next, Vitest

Spec: `docs/superpowers/specs/2026-03-30-freshrss-connection-validation-design.md`

---

## File Structure

| Action | File                                                 | Responsibility                                  |
| ------ | ---------------------------------------------------- | ----------------------------------------------- |
| Modify | `src-tauri/src/commands/account_commands.rs`         | `add_account` を async 化、認証テスト追加       |
| Modify | `src/components/settings/account-config-form.tsx`    | ボタンテキスト変更（接続確認中...）、エラー分岐 |
| Modify | `src/locales/ja/common.json`                         | `connection_testing` キー追加                   |
| Modify | `src/locales/en/common.json`                         | `connection_testing` キー追加                   |
| Modify | `src/locales/ja/settings.json`                       | エラーメッセージキー追加                        |
| Modify | `src/locales/en/settings.json`                       | エラーメッセージキー追加                        |
| Modify | `src/__tests__/components/add-account-form.test.tsx` | 接続失敗テスト追加                              |

---

### Task 1: i18n キーの追加

### Task 1 Files

- Modify: `src/locales/ja/common.json`
- Modify: `src/locales/en/common.json`
- Modify: `src/locales/ja/settings.json`
- Modify: `src/locales/en/settings.json`

- [ ] **Step 1: `common.json` に `connection_testing` キーを追加**

`src/locales/ja/common.json` に追加:

```json
"connection_testing": "接続を確認中..."
```

`src/locales/en/common.json` に追加:

```json
"connection_testing": "Testing connection..."
```

- [ ] **Step 2: `settings.json` にエラーメッセージキーを追加**

`src/locales/ja/settings.json` の `account` オブジェクト内に追加:

```json
"error_network": "サーバーに接続できません。URLを確認してください",
"error_auth": "認証に失敗しました。ユーザー名とAPIパスワードを確認してください",
"error_auth_hint_freshrss": "FreshRSSのプロフィール設定からAPIパスワードを設定する必要があります"
```

`src/locales/en/settings.json` の `account` オブジェクト内に追加:

```json
"error_network": "Cannot connect to server. Please check the URL",
"error_auth": "Authentication failed. Please check your username and API password",
"error_auth_hint_freshrss": "You need to set an API password in FreshRSS Profile settings"
```

- [ ] **Step 3: Commit**

```bash
git add src/locales/ja/common.json src/locales/en/common.json src/locales/ja/settings.json src/locales/en/settings.json
git commit -m "feat: add i18n keys for connection validation messages"
```

---

### Task 2: Rust — `add_account` を async 化し認証テストを追加

### Task 2 Files

- Modify: `src-tauri/src/commands/account_commands.rs:23-71`

### Task 2 背景

- 現在の `add_account` は `pub fn`（同期関数）。`authenticate()` は `async fn` なので async 化が必要。
- Tauri 2 は `#[tauri::command]` で `async fn` をサポート。`feed_commands.rs` の `trigger_sync` が同パターン。
- `rust-async-mutex` ルール: `.await` 中に DB ロックを保持しない。認証テストは DB 保存前なので問題なし。
- `reqwest::Client` にタイムアウト 15 秒を設定。

- [ ] **Step 1: 必要な import を追加**

`src-tauri/src/commands/account_commands.rs` の先頭に以下を追加:

```rust
use std::time::Duration;

use crate::infra::provider::greader::GReaderProvider;
use crate::infra::provider::traits::Credentials;
```

既存の未使用 import があればそのまま残す。`SqlitePreferenceRepository` は Inoreader の `app_id`/`app_key` 取得に必要なので合わせて追加:

```rust
use crate::infra::db::sqlite_preference::SqlitePreferenceRepository;
use crate::repository::preference::PreferenceRepository;
```

- [ ] **Step 2: `add_account` を `pub async fn` に変更し認証テストを追加**

`add_account` 関数全体を以下に置き換える:

```rust
#[tauri::command]
pub async fn add_account(
    state: State<'_, AppState>,
    kind: String,
    name: String,
    server_url: Option<String>,
    username: Option<String>,
    password: Option<String>,
) -> Result<AccountDto, AppError> {
    let provider_kind = match kind.as_str() {
        "Local" => ProviderKind::Local,
        "FreshRss" => ProviderKind::FreshRss,
        "Inoreader" => ProviderKind::Inoreader,
        _ => {
            return Err(AppError::UserVisible {
                message: "Unknown provider kind".into(),
            })
        }
    };

    let account = Account {
        id: AccountId::new(),
        kind: provider_kind,
        name,
        server_url,
        username,
        sync_interval_secs: 3600,
        sync_on_wake: false,
        keep_read_items_days: 30,
    };

    // Validate connection for remote providers (no DB lock held)
    if matches!(
        account.kind,
        ProviderKind::FreshRss | ProviderKind::Inoreader
    ) {
        let mut provider = match account.kind {
            ProviderKind::FreshRss => {
                GReaderProvider::for_freshrss(account.server_url.as_deref().unwrap_or_default())
            }
            ProviderKind::Inoreader => {
                let (app_id, app_key) = {
                    let db_guard = state.db.lock().map_err(|e| AppError::UserVisible {
                        message: format!("Lock error: {e}"),
                    })?;
                    let pref_repo = SqlitePreferenceRepository::new(db_guard.reader());
                    (
                        pref_repo.get("inoreader_app_id").unwrap_or(None),
                        pref_repo.get("inoreader_app_key").unwrap_or(None),
                    )
                }; // DB lock dropped here
                GReaderProvider::for_inoreader(app_id, app_key)
            }
            _ => unreachable!(),
        };

        provider
            .authenticate(&Credentials {
                token: account.username.clone(),
                password: password.clone(),
            })
            .await?;
    }

    // Store password in OS keyring BEFORE DB save (fail fast)
    if matches!(
        account.kind,
        ProviderKind::FreshRss | ProviderKind::Inoreader
    ) {
        if let Some(ref pw) = password {
            keyring_store::set_password(account.id.as_ref(), pw)?;
        }
    }

    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let repo = SqliteAccountRepository::new(db.writer());
    repo.save(&account)?;

    Ok(AccountDto::from(account))
}
```

- [ ] **Step 3: `GReaderProvider` にタイムアウト付き HTTP client を設定**

`src-tauri/src/infra/provider/greader.rs` の `for_freshrss` と `for_inoreader` で `reqwest::Client::new()` を使用している箇所を、タイムアウト付きに変更:

```rust
// for_freshrss 内:
http_client: reqwest::Client::builder()
    .timeout(Duration::from_secs(15))
    .build()
    .unwrap_or_default(),

// for_inoreader 内:
http_client: reqwest::Client::builder()
    .timeout(Duration::from_secs(15))
    .build()
    .unwrap_or_default(),
```

`greader.rs` の先頭に `use std::time::Duration;` を追加。

- [ ] **Step 4: ビルド確認**

```bash
cd src-tauri && cargo check
```

Expected: 警告はあるかもしれないがエラー 0 件。`add_account` が async になっても Tauri は自動的にハンドリングする。

- [ ] **Step 5: 既存テスト確認**

```bash
cd src-tauri && cargo test
```

Expected: 全テスト PASS。`add_account` の sync → async 変更は Tauri command の登録方法に影響しない。

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/account_commands.rs src-tauri/src/infra/provider/greader.rs
git commit -m "feat: validate connection before saving account (add_account async)"
```

---

### Task 3: フロントエンド — ボタンテキストとエラーハンドリング改善

### Task 3 Files

- Modify: `src/components/settings/account-config-form.tsx:48-79,188-194`

### Task 3 背景

- 現在のボタンは `submitting ? "追加中..." : "追加"`。リモートプロバイダの場合は `"接続を確認中..."` に変更。
- エラーハンドリングは既存の `Result.inspectError` 内で `AppError.type` を見て分岐。
- `AppError` の構造: `{ type: "UserVisible" | "Retryable", message: string }`

- [ ] **Step 1: import に `useCallback` を追加（未追加の場合）**

`account-config-form.tsx` の先頭の import を確認。`useCallback` が既にあれば不要。

- [ ] **Step 2: submitting 中のボタンテキストをプロバイダ種別で分岐**

`account-config-form.tsx` のボタン部分（189行目付近）を変更:

現在:

```tsx
{
  submitting ? tc("adding") : tc("add");
}
```

変更後:

```tsx
{
  submitting
    ? formConfig.requiresCredentials
      ? tc("connection_testing")
      : tc("adding")
    : tc("add");
}
```

- [ ] **Step 3: エラーハンドリングでプロバイダ固有のヒントを追加**

`handleSubmit` 内の `Result.inspectError` コールバック（64-68行目）を変更:

現在:

```tsx
Result.inspectError((e) => {
  const message = t("account.failed_to_add", { message: e.message });
  setErrorMessage(message);
  useUiStore.getState().showToast(message);
}),
```

変更後:

```tsx
Result.inspectError((e) => {
  const appError = e as { type?: string; message: string };
  let message: string;
  if (appError.type === "Retryable") {
    message = t("account.error_network");
  } else if (appError.message.toLowerCase().includes("auth")) {
    message = t("account.error_auth");
    if (kind === "FreshRss") {
      message += `\n${t("account.error_auth_hint_freshrss")}`;
    }
  } else {
    message = t("account.failed_to_add", { message: e.message });
  }
  setErrorMessage(message);
  useUiStore.getState().showToast(message);
}),
```

- [ ] **Step 4: フォーマット確認**

```bash
mise run format
```

Expected: フォーマット成功。

- [ ] **Step 5: 型チェック + lint**

```bash
mise run lint
```

Expected: エラー 0 件。

- [ ] **Step 6: Commit**

```bash
git add src/components/settings/account-config-form.tsx
git commit -m "feat: show connection testing spinner and categorized error messages"
```

---

### Task 4: テスト — 接続失敗時のエラー表示テスト

### Task 4 Files

- Modify: `src/__tests__/components/add-account-form.test.tsx`

### Task 4 背景

- 既存テストでは `addAccount` の成功パス＋バリデーション失敗をテスト済み。
- 接続失敗（Rust 側から `AppError` が返る）ケースを追加。
- `setupTauriMocks` のカスタムハンドラで `add_account` をエラーレスポンスに差し替える。
- Tauri mock の IPC エラーは throw されるので、`safeInvoke` が `Failure` に変換する。

- [ ] **Step 1: ネットワークエラー時のテストを追加**

`add-account-form.test.tsx` に以下のテストを追加:

```tsx
it("shows network error toast when connection to FreshRSS server fails", async () => {
  setupTauriMocks((cmd) => {
    if (cmd === "add_account") {
      throw { type: "Retryable", message: "Network error: connection refused" };
    }
    return null;
  });

  const user = userEvent.setup();
  render(<AddAccountForm />, { wrapper: createWrapper() });

  await selectService(user, "FreshRSS");
  await user.type(
    screen.getByLabelText("Server URL"),
    "https://bad-server.example.com",
  );
  await user.type(screen.getByLabelText("Username"), "alice");
  await user.type(screen.getByLabelText("Password"), "secret");
  await user.click(screen.getByRole("button", { name: "Add" }));

  await waitFor(() => {
    expect(useUiStore.getState().toastMessage).toEqual({
      message: "Cannot connect to server. Please check the URL",
    });
  });
});
```

- [ ] **Step 2: 認証エラー時のテスト（FreshRSS ヒント付き）を追加**

```tsx
it("shows auth error with FreshRSS API password hint when authentication fails", async () => {
  setupTauriMocks((cmd) => {
    if (cmd === "add_account") {
      throw {
        type: "UserVisible",
        message: "Auth error: Authentication failed: 403",
      };
    }
    return null;
  });

  const user = userEvent.setup();
  render(<AddAccountForm />, { wrapper: createWrapper() });

  await selectService(user, "FreshRSS");
  await user.type(
    screen.getByLabelText("Server URL"),
    "https://freshrss.example.com",
  );
  await user.type(screen.getByLabelText("Username"), "alice");
  await user.type(screen.getByLabelText("Password"), "wrong-password");
  await user.click(screen.getByRole("button", { name: "Add" }));

  await waitFor(() => {
    const toast = useUiStore.getState().toastMessage;
    expect(toast?.message).toContain("Authentication failed");
    expect(toast?.message).toContain("API password");
  });
});
```

- [ ] **Step 3: ボタンテキストが「接続を確認中...」になることのテスト**

```tsx
it("shows 'Testing connection...' button text while submitting FreshRSS account", async () => {
  let resolveAddAccount: ((value: unknown) => void) | null = null;

  setupTauriMocks((cmd) => {
    if (cmd === "add_account") {
      return new Promise<unknown>((resolve) => {
        resolveAddAccount = resolve;
      });
    }
    return null;
  });

  const user = userEvent.setup();
  render(<AddAccountForm />, { wrapper: createWrapper() });

  await selectService(user, "FreshRSS");
  await user.type(
    screen.getByLabelText("Server URL"),
    "https://freshrss.example.com",
  );
  await user.type(screen.getByLabelText("Username"), "alice");
  await user.type(screen.getByLabelText("Password"), "secret");
  await user.click(screen.getByRole("button", { name: "Add" }));

  expect(
    screen.getByRole("button", { name: "Testing connection..." }),
  ).toBeDisabled();

  // Clean up
  resolveAddAccount?.({
    id: "acc-new",
    kind: "FreshRss",
    name: "FreshRSS",
    username: "alice",
    server_url: "https://freshrss.example.com",
    sync_interval_secs: 3600,
    sync_on_wake: false,
    keep_read_items_days: 30,
  });

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Add" })).not.toBeDisabled();
  });
});
```

- [ ] **Step 4: テスト実行**

```bash
mise run test
```

Expected: 全テスト PASS。

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/components/add-account-form.test.tsx
git commit -m "test: add connection validation error scenarios for FreshRSS"
```

---

### Task 5: 最終検証

- [ ] **Step 1: 全品質チェック実行**

```bash
mise run check
```

Expected: format + lint + test 全て PASS。

- [ ] **Step 2: Rust テスト確認**

```bash
cd src-tauri && cargo test
```

Expected: 全テスト PASS。

- [ ] **Step 3: ビルド確認**

```bash
mise run ci
```

Expected: format + lint + test + build 全て PASS。
