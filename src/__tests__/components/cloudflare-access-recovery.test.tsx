import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { sampleAccounts } from "@tests/helpers/fixtures";
import i18n from "@tests/helpers/i18n-setup";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import { resetTauriRuntimeFlags, setTauriRuntimePresent } from "@tests/helpers/tauri-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountConfigForm } from "@/components/settings/add-account/account-config-form";
import { useAccountDetailCredentialsEditor } from "@/components/settings/hooks/account-detail/use-account-detail-credentials-editor";
import { useUiStore } from "@/stores/ui-store";

const recoveryCopy = {
  en: "Credentials could not be restored after a failed save. Re-enter your FreshRSS password and Cloudflare Access credentials, or remove Access, before reconnecting.",
  ja: "保存失敗後に認証情報を復元できませんでした。再接続する前に FreshRSS のパスワードと Cloudflare Access の認証情報を入力し直すか、Access を削除してください。",
};

function throwRollbackFailure() {
  throw {
    type: "UserVisible",
    message:
      "Write reflected current-dummy-secret previous-dummy-secret. Credential rollback failed (FreshRSS password: failed; Cloudflare Access: restored). Recovery required: re-enter credentials or remove Access in account settings before reconnecting.",
  };
}

describe("Cloudflare Access recovery through native command wrappers", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
    setTauriRuntimePresent();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    resetTauriRuntimeFlags();
    useUiStore.setState(useUiStore.getInitialState());
  });

  it.each([
    { language: "en", action: "replace", metadataFailed: false },
    { language: "ja", action: "replace", metadataFailed: false },
    { language: "en", action: "replace", metadataFailed: true },
    { language: "ja", action: "replace", metadataFailed: true },
    { language: "en", action: "remove", metadataFailed: false },
    { language: "ja", action: "remove", metadataFailed: false },
    { language: "en", action: "remove", metadataFailed: true },
    { language: "ja", action: "remove", metadataFailed: true },
  ] satisfies Array<{ language: keyof typeof recoveryCopy; action: "replace" | "remove"; metadataFailed: boolean }>)(
    "shows detail recovery ($language, $action, metadata failed: $metadataFailed)",
    async ({ language, action, metadataFailed }) => {
      const diagnostics = vi.spyOn(console, "error").mockImplementation(() => {});
      setupTauriMocks((cmd) => {
        if (cmd === "get_account_cloudflare_access") {
          if (metadataFailed) throw { type: "UserVisible", message: "Metadata unavailable" };
          return { client_id: "saved-dummy-id" };
        }
        if (cmd === "update_account_credentials") throwRollbackFailure();
        return undefined;
      });
      const { queryClient, wrapper } = createQueryWrapper({ includeToastHost: true });
      const { result } = renderHook(
        () =>
          useAccountDetailCredentialsEditor({
            account: sampleAccounts[1],
            queryClient,
            t: i18n.getFixedT(language, "settings"),
          }),
        { wrapper },
      );
      await waitFor(() => expect(result.current.cloudflareAccessStatus).toBe(metadataFailed ? "error" : "ready"));
      diagnostics.mockClear();
      act(() => {
        if (metadataFailed) result.current.setCloudflareAccessRecoveryAction(action);
        if (action === "replace") {
          result.current.setCloudflareAccessClientId("dummy-id");
          result.current.setCloudflareAccessSecret("current-dummy-secret");
        } else if (!metadataFailed) {
          result.current.setCloudflareAccessEnabled(false);
        }
      });
      await act(async () => {
        expect(await result.current.commitCredentials()).toBe(false);
      });
      expect(useUiStore.getState().toastMessage?.message).toContain(recoveryCopy[language]);
      expect(document.body.textContent).toContain(recoveryCopy[language]);
      expect(document.body.textContent).not.toMatch(/current-dummy-secret|previous-dummy-secret/);
      expect(diagnostics).not.toHaveBeenCalled();
      expect(result.current.cloudflareAccessSecret).toBe(action === "replace" ? "current-dummy-secret" : "");
    },
  );

  it.each(["en", "ja"] satisfies Array<keyof typeof recoveryCopy>)(
    "shows localized add recovery after replacement rollback failure (%s)",
    async (language) => {
      await i18n.changeLanguage(language);
      const diagnostics = vi.spyOn(console, "error").mockImplementation(() => {});
      setupTauriMocks((cmd) => {
        if (cmd === "add_account") throwRollbackFailure();
        return undefined;
      });
      const { wrapper } = createQueryWrapper();
      render(
        <AccountConfigForm
          kind="FreshRss"
          onBack={() => {}}
          debugState={{
            serverUrl: "https://reader.example.com",
            username: "alice",
            password: "dummy-password",
            cloudflareAccessEnabled: true,
            cloudflareAccessClientId: "dummy-id",
          }}
        />,
        { wrapper },
      );
      const t = i18n.getFixedT(language, "settings");
      fireEvent.change(screen.getByLabelText(t("account.cloudflare_access_secret")), {
        target: { value: "current-dummy-secret" },
      });
      await userEvent.setup().click(screen.getByRole("button", { name: i18n.getFixedT(language, "common")("add") }));
      await waitFor(() => expect(screen.getByText(recoveryCopy[language])).toBeInTheDocument());
      expect(useUiStore.getState().toastMessage?.message).toBe(recoveryCopy[language]);
      expect(document.body.textContent).not.toMatch(/current-dummy-secret|previous-dummy-secret/);
      expect(diagnostics).not.toHaveBeenCalled();
    },
  );
});
