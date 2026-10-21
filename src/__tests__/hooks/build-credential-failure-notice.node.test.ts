import i18n from "@tests/helpers/i18n-setup";
import { describe, expect, it, vi } from "vitest";
import { buildCredentialFailureNotice } from "@/components/settings/hooks/account-detail/build-credential-failure-notice";
import type { CredentialFailureNotice } from "@/lib/account/credential-failure";

const en = i18n.getFixedT("en", "settings");
const ja = i18n.getFixedT("ja", "settings");

function createHandlers() {
  return {
    retryCloudflareAccessLoad: vi.fn(),
    commitCredentials: vi.fn(async () => true),
    handleTestConnection: vi.fn(async () => true),
    testingConnection: false,
  };
}

describe("buildCredentialFailureNotice", () => {
  it.each([
    ["read_failed", "Couldn’t read Cloudflare Access credentials from Keychain."],
    ["write_failed", "Couldn’t save Cloudflare Access credentials to Keychain."],
    ["canceled", "Access to Keychain was canceled. To continue, try again and allow access."],
    ["not_allowed", "Couldn’t continue because access to Keychain wasn’t allowed."],
    ["unverified", "Couldn’t verify that saving Cloudflare Access credentials succeeded."],
  ] as const)("names what happened for %s in the store's own words", (cause, expected) => {
    const notice: CredentialFailureNotice = { target: "cloudflare_access", cause, operation: "save" };

    expect(buildCredentialFailureNotice(notice, "keychain", en, createHandlers()).lines[0]).toBe(expected);
  });

  it.each([
    ["keychain", "キーチェーン"],
    ["credential_manager", "資格情報マネージャー"],
    ["local_file", "ローカルファイル"],
  ] as const)("uses the %s store name instead of the old keyring wording", (storeKind, name) => {
    const notice: CredentialFailureNotice = { target: "password", cause: "write_failed", operation: "save" };

    const [first] = buildCredentialFailureNotice(notice, storeKind, ja, createHandlers()).lines;

    expect(first).toBe(`パスワードを${name}に保存できませんでした。`);
    expect(first).not.toContain("キーリング");
  });

  it("does not reuse the sync-settings prefix for a credential save failure", () => {
    const notice: CredentialFailureNotice = { target: "password", cause: "write_failed", operation: "save" };

    const { lines } = buildCredentialFailureNotice(notice, "keychain", ja, createHandlers());

    expect(lines.join("")).not.toContain("同期設定の更新に失敗しました");
  });

  it("leads with the saved state when only the connection check failed after a save", () => {
    const notice: CredentialFailureNotice = { target: "password", cause: "not_allowed", operation: "check_after_save" };

    const { lines } = buildCredentialFailureNotice(notice, "keychain", ja, createHandlers());

    expect(lines[0]).toBe("保存しましたが、接続を確認できませんでした。");
    expect(lines[1]).toBe("キーチェーンへのアクセスが許可されなかったため、処理を続けられませんでした。");
  });

  it.each([
    ["load", "Try Again", "retryCloudflareAccessLoad"],
    ["save", "Retry Save", "commitCredentials"],
    ["check", "Retry Check", "handleTestConnection"],
    ["check_after_save", "Retry Check", "handleTestConnection"],
  ] as const)("retries the %s operation with the %s action", (operation, label, handler) => {
    const handlers = createHandlers();
    const notice: CredentialFailureNotice = { target: "cloudflare_access", cause: "canceled", operation };

    const view = buildCredentialFailureNotice(notice, "keychain", en, handlers);
    view.onRetry();

    expect(view.retryLabel).toBe(label);
    expect(handlers[handler]).toHaveBeenCalledTimes(1);
  });

  it("disables the retry while a connection test is running", () => {
    const notice: CredentialFailureNotice = { target: "password", cause: "canceled", operation: "save" };

    const view = buildCredentialFailureNotice(notice, "keychain", en, { ...createHandlers(), testingConnection: true });

    expect(view.retryDisabled).toBe(true);
  });
});
