import type { TFunction } from "i18next";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAccountDetailErrorToast } from "@/components/settings/account-detail/toast";
import { useUiStore } from "@/stores/ui-store";

describe("account-detail-toast", () => {
  afterEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("shows translated account detail errors as toasts", async () => {
    const showToast = vi.fn();
    const t = ((key: string, values?: Record<string, unknown>) =>
      key === "account.failed_to_rename"
        ? `Failed to rename account: ${String(values?.message)}`
        : key) as TFunction<"settings">;
    useUiStore.setState({ showToast });

    createAccountDetailErrorToast(
      t,
      "account.failed_to_rename",
    )({
      message: "boom",
      title: "Rename failed",
    });

    expect(showToast).toHaveBeenCalledWith("Failed to rename account: boom");
  });

  it("redacts provider credentials, server URL, and account identifiers before showing error toasts", async () => {
    const showToast = vi.fn();
    const t = ((key: string, values?: Record<string, unknown>) =>
      key === "account.connection_failed"
        ? `Connection failed: ${String(values?.message)}`
        : key) as TFunction<"settings">;
    useUiStore.setState({ showToast });

    createAccountDetailErrorToast(
      t,
      "account.connection_failed",
    )({
      message:
        "Auth failed for server_url=https://reader.example.com/api/greader.php username=secret-user@example.com account_id=acc-provider-secret GoogleLogin auth=provider-auth-token Cookie: provider_session=raw-cookie",
      title: "Connection failed",
    });

    const toastMessage = showToast.mock.calls[0]?.[0] as string;
    expect(toastMessage).toContain("server_url=<redacted>");
    expect(toastMessage).toContain("username=<redacted>");
    expect(toastMessage).toContain("account_id=<redacted>");
    expect(toastMessage).not.toContain("https://reader.example.com/api/greader.php");
    expect(toastMessage).not.toContain("secret-user@example.com");
    expect(toastMessage).not.toContain("acc-provider-secret");
    expect(toastMessage).not.toContain("provider-auth-token");
    expect(toastMessage).not.toContain("provider_session=raw-cookie");
  });
});
