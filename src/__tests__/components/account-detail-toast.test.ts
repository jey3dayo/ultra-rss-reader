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
});
