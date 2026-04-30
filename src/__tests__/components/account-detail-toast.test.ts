import { afterEach, describe, expect, it, vi } from "vitest";
import { createAccountDetailErrorToast } from "@/components/settings/account-detail-toast";
import i18n from "@/lib/i18n";
import { useUiStore } from "@/stores/ui-store";

const t = i18n.getFixedT("en", "settings");

describe("account-detail-toast", () => {
  afterEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("shows translated account detail errors as toasts", () => {
    const showToast = vi.fn();
    useUiStore.setState({ showToast });

    createAccountDetailErrorToast(t, "account.failed_to_rename")({ message: "boom" });

    expect(showToast).toHaveBeenCalledWith("Failed to rename account: boom");
  });
});
