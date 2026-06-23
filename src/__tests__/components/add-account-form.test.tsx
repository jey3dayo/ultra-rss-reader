import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createQueryWrapper, createWrapper } from "@tests/helpers/create-wrapper";
import { sampleAccounts } from "@tests/helpers/fixtures";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddAccountForm } from "@/components/settings/add-account/controller";
import { ServicePicker } from "@/components/settings/add-account/service-picker";
import { buildServicePickerCategories } from "@/components/settings/add-account/service-picker-categories";
import { runAccountSetupSync } from "@/components/settings/hooks/account-detail/use-account-detail-sync-controls";
import i18n from "@/lib/i18n";
import { queryKeys } from "@/lib/query/query-invalidation";
import enSettings from "@/locales/en/settings.json";
import jaSettings from "@/locales/ja/settings.json";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

const localeMockState = vi.hoisted(() => ({ language: "en" as "en" | "ja" }));

vi.mock("react-i18next", () => {
  const settingsAccountTranslations: Record<"en" | "ja", Record<string, string>> = {
    en: {
      "account.heading": "Add Account",
      "account.category_local": "Local",
      "account.category_self_hosted": "Self-Hosted",
      "account.category_services": "Services",
      "account.local_feeds": "Local Feeds",
      "account.local_desc": "On My Mac",
      "account.freshrss": "FreshRSS",
      "account.freshrss_desc": "freshrss.org",
      "account.fever": "Fever",
      "account.fever_desc": "Deprecated. Not recommended.",
      "account.feedly": "Feedly",
      "account.newsblur": "NewsBlur",
      "account.feedbin": "Feedbin",
      "account.feedbin_hold_desc": "On hold for API integration",
      "account.feedly_hold_desc": "On hold due to enterprise-only API access",
      "account.coming_soon": "Coming soon",
      "account.back_to_services": "Back to services",
      "account.account": "Account",
      "account.name": "Name",
      "account.server_url": "Server URL",
      "account.server_url_placeholder": "https://example.com",
      "account.username": "Username",
      "account.password": "Password",
      "account.error_server_url_required": "Server URL is required",
      "account.error_server_url_invalid": "Enter a valid server URL",
      "account.error_username_required": "Username is required",
      "account.error_password_required": "Password is required",
      "account.error_network": "Cannot connect to server. Please check the URL",
      "account.error_auth": "Authentication failed. Please check your username and API password",
      "account.error_auth_hint_freshrss": "You need to set an API password in FreshRSS Profile settings",
      "account.failed_to_add": "Failed to add account: {{message}}",
    },
    ja: {
      "account.heading": "アカウントを追加",
      "account.category_local": "ローカル",
      "account.category_self_hosted": "セルフホスト",
      "account.category_services": "サービス",
      "account.local_feeds": "ローカルフィード",
      "account.local_desc": "この端末",
      "account.freshrss": "FreshRSS",
      "account.freshrss_desc": "FreshRSS サーバー",
      "account.fever": "Fever",
      "account.fever_desc": "非推奨",
      "account.feedly": "Feedly",
      "account.newsblur": "NewsBlur",
      "account.feedbin": "Feedbin",
      "account.feedbin_hold_desc": "API連携のため保留",
      "account.feedly_hold_desc": "法人向けAPIのため保留",
      "account.coming_soon": "準備中",
      "account.back_to_services": "サービス一覧に戻る",
      "account.account": "アカウント",
      "account.name": "名前",
      "account.server_url": "サーバーURL",
      "account.server_url_placeholder": "https://example.com",
      "account.username": "ユーザー名",
      "account.password": "パスワード",
      "account.error_server_url_required": "サーバーURLを入力してください",
      "account.error_server_url_invalid": "有効なサーバーURLを入力してください",
      "account.error_username_required": "ユーザー名を入力してください",
      "account.error_password_required": "パスワードを入力してください",
      "account.error_network": "サーバーに接続できません。URLを確認してください",
      "account.error_auth": "認証に失敗しました。ユーザー名とAPIパスワードを確認してください",
      "account.error_auth_hint_freshrss": "FreshRSSのプロフィール設定でAPIパスワードを設定してください",
      "account.failed_to_add": "アカウントの追加に失敗しました: {{message}}",
    },
  };
  const commonTranslations: Record<string, string> = {
    back: "Back",
    cancel: "Cancel",
    add: "Add",
    adding: "Adding…",
    connection_testing: "Testing connection…",
  };

  return {
    I18nextProvider: ({ children }: { children: ReactNode }) => children,
    initReactI18next: {
      type: "3rdParty",
      init: () => undefined,
    },
    useTranslation: (namespace?: string) => ({
      t: (key: string, options?: Record<string, string>) =>
        namespace === "common" && key in commonTranslations
          ? commonTranslations[key]
          : namespace === "settings" && key in settingsAccountTranslations[localeMockState.language]
            ? settingsAccountTranslations[localeMockState.language][key].replace("{{message}}", options?.message ?? "")
            : key,
    }),
  };
});

const servicePickerSource = readFileSync(
  join(process.cwd(), "src/components/settings/add-account/service-picker.tsx"),
  "utf8",
);
const addAccountControllerSource = readFileSync(
  join(process.cwd(), "src/components/settings/add-account/controller.tsx"),
  "utf8",
);
const servicePickerCategoriesSource = readFileSync(
  join(process.cwd(), "src/components/settings/add-account/service-picker-categories.ts"),
  "utf8",
);
const accountConfigFormSource = readFileSync(
  join(process.cwd(), "src/components/settings/add-account/account-config-form.tsx"),
  "utf8",
);
const accountConfigFormViewSource = readFileSync(
  join(process.cwd(), "src/components/settings/add-account/account-config-form-view.tsx"),
  "utf8",
);

async function selectService(user: ReturnType<typeof userEvent.setup>, serviceName: string) {
  await user.click(screen.getByRole("button", { name: new RegExp(serviceName) }));
}

function setupPendingAddAccount(onArgs?: (args: Record<string, unknown>) => void) {
  let resolveAddAccount: ((value: unknown) => void) | undefined;

  setupTauriMocks((cmd, args) => {
    if (cmd !== "add_account") {
      return null;
    }

    onArgs?.(args);
    return new Promise<unknown>((resolve) => {
      resolveAddAccount = resolve;
    });
  });

  return {
    resolve(value: unknown) {
      if (!resolveAddAccount) {
        throw new Error("add_account did not start");
      }

      resolveAddAccount(value);
    },
  };
}

function createI18nWrapper() {
  const QueryWrapper = createWrapper();

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <I18nextProvider i18n={i18n}>
        <QueryWrapper>{children}</QueryWrapper>
      </I18nextProvider>
    );
  }

  return Wrapper;
}

describe("AddAccountForm", () => {
  beforeEach(() => {
    localeMockState.language = "en";
    useUiStore.setState(useUiStore.getInitialState());
    usePreferencesStore.setState({ prefs: {}, loaded: true });
  });

  it("renders the service picker with categories", () => {
    const { container } = render(<AddAccountForm />, { wrapper: createI18nWrapper() });

    expect(container.firstElementChild).toHaveClass("min-h-0", "flex-1", "overflow-y-auto", "p-6");
    expect(screen.getByText("Local Feeds")).toBeInTheDocument();
    expect(screen.getByText("FreshRSS")).toBeInTheDocument();
    expect(screen.getByText("Feedly")).toBeInTheDocument();
    expect(screen.getByText("Fever")).toBeInTheDocument();
  });

  it("renders the service picker from service and description props", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const TestIcon = ({ className }: { className?: string }) => <span className={className} data-testid="test-icon" />;

    render(
      <ServicePicker
        title="Choose a service"
        categories={[
          {
            id: "custom",
            label: "Custom category",
            services: [
              {
                kind: "Local",
                icon: TestIcon,
                iconBg: "bg-state-success",
                name: "Custom Local",
                description: "Custom local description",
              },
              {
                kind: "Feedly",
                icon: TestIcon,
                iconBg: "bg-state-warning",
                name: "Custom Feedly",
                description: "Custom feedly description",
                disabled: true,
                disabledLabel: "Unavailable",
              },
            ],
          },
        ]}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole("heading", { name: "Choose a service" })).toBeInTheDocument();
    expect(screen.getByText("Custom category")).toBeInTheDocument();
    expect(screen.getByText("Custom local description")).toBeInTheDocument();
    expect(screen.getByText("Custom feedly description")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Custom Local/ }));
    await user.click(screen.getByRole("button", { name: /Custom Feedly/ }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith("Local");
  });

  it("derives service picker copy from settings translations in the category builder", () => {
    const translations: Record<string, string> = {
      "account.category_local": jaSettings.account.category_local,
      "account.category_self_hosted": jaSettings.account.category_self_hosted,
      "account.category_services": jaSettings.account.category_services,
      "account.local_feeds": jaSettings.account.local_feeds,
      "account.local_desc": jaSettings.account.local_desc,
      "account.freshrss": jaSettings.account.freshrss,
      "account.freshrss_desc": jaSettings.account.freshrss_desc,
      "account.fever": jaSettings.account.fever,
      "account.fever_desc": jaSettings.account.fever_desc,
      "account.feedly": jaSettings.account.feedly,
      "account.newsblur": jaSettings.account.newsblur,
      "account.feedbin": jaSettings.account.feedbin,
      "account.feedbin_hold_desc": jaSettings.account.feedbin_hold_desc,
      "account.feedly_hold_desc": jaSettings.account.feedly_hold_desc,
      "account.coming_soon": jaSettings.account.coming_soon,
    };
    const categories = buildServicePickerCategories((key) => {
      return translations[key] ?? key;
    });

    expect(categories[0]).toEqual(
      expect.objectContaining({
        id: "account.category_local",
        label: jaSettings.account.category_local,
      }),
    );
    expect(categories.flatMap((category) => category.services)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "Feedly",
          name: jaSettings.account.feedly,
          description: jaSettings.account.feedly_hold_desc,
          disabledLabel: jaSettings.account.coming_soon,
        }),
        expect.objectContaining({
          kind: "Feedbin",
          name: jaSettings.account.feedbin,
          description: jaSettings.account.feedbin_hold_desc,
          disabledLabel: jaSettings.account.coming_soon,
        }),
      ]),
    );
  });

  it("can start directly on the provider config screen for debugging", async () => {
    const user = userEvent.setup();

    const { container } = render(<AddAccountForm initialKind="FreshRss" />, {
      wrapper: createWrapper(),
    });

    expect(container.firstElementChild).toHaveClass("min-h-0", "flex-1", "overflow-y-auto");
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Server URL")).toBeInTheDocument();
    expect(screen.queryByText("Local Feeds")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Back/ }));

    await waitFor(() => {
      expect(screen.getByText("Local Feeds")).toBeInTheDocument();
    });
  });

  it("can render a fixed loading state for Storybook debugging", () => {
    render(
      <AddAccountForm
        initialKind="FreshRss"
        debugState={{
          name: "Work RSS",
          serverUrl: "https://freshrss.example.com",
          username: "alice",
          password: "secret",
          submitting: true,
        }}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Work RSS");
    expect(screen.getByLabelText("Server URL")).toHaveValue("https://freshrss.example.com");
    expect(screen.getByLabelText("Username")).toHaveValue("alice");
    expect(screen.getByLabelText("Password")).toHaveValue("secret");
    expect(screen.getByRole("button", { name: "Testing connection…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("intercepts submit in Storybook debug mode instead of calling the Tauri command", async () => {
    const user = userEvent.setup();
    const addAccountCalls = vi.fn();

    setupTauriMocks((cmd) => {
      if (cmd === "add_account") {
        addAccountCalls();
      }
      return null;
    });

    render(
      <AddAccountForm
        initialKind="FreshRss"
        debugState={{
          name: "Work RSS",
          serverUrl: "https://freshrss.example.com",
          username: "alice",
          password: "secret",
          submitMessage: "Storybook preview only",
        }}
      />,
      { wrapper: createWrapper() },
    );

    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(addAccountCalls).not.toHaveBeenCalled();
    expect(screen.getByText("Storybook preview only")).toBeInTheDocument();
  });

  it.each([
    ["en", "Coming soon"],
    ["ja", "準備中"],
  ] as const)("shows planned services as disabled with the %s coming-soon label", async (language, comingSoonLabel) => {
    localeMockState.language = language;
    await i18n.changeLanguage(language);

    render(<AddAccountForm />, { wrapper: createI18nWrapper() });

    const feverButton = screen.getByRole("button", {
      name: /Fever|account\.fever/,
    });
    const feedlyButton = screen.getByRole("button", {
      name: /Feedly|account\.feedly/,
    });
    const newsBlurButton = screen.getByRole("button", {
      name: /NewsBlur|account\.newsblur/,
    });
    const feedbinButton = screen.getByRole("button", {
      name: /Feedbin|account\.feedbin/,
    });
    const comingSoonLabels = screen.getAllByText(comingSoonLabel);

    expect(feverButton).toBeDisabled();
    expect(feedlyButton).toBeDisabled();
    expect(newsBlurButton).toBeDisabled();
    expect(feedbinButton).toBeDisabled();
    expect(enSettings.account.coming_soon).toBe("Coming soon");
    expect(jaSettings.account.coming_soon).toBe("準備中");
    expect(comingSoonLabels).toHaveLength(4);
    expect(screen.queryByText("工事中")).not.toBeInTheDocument();
    expect(screen.queryByText("account.coming_soon")).not.toBeInTheDocument();
  });

  it("keeps service picker free of translation and service catalog dependencies", () => {
    expect(servicePickerSource).not.toContain("useTranslation");
    expect(servicePickerSource).not.toContain("SERVICE_CATEGORIES");
    expect(addAccountControllerSource).toContain("useTranslation");
    expect(addAccountControllerSource).toContain("buildServicePickerCategories");
    expect(servicePickerCategoriesSource).toContain("SERVICE_CATEGORIES");
  });

  it("delegates hover styling to the shared nav row button", () => {
    expect(servicePickerSource).not.toContain("hover:border-border");
    expect(servicePickerSource).not.toContain("hover:bg-surface-2");

    render(<AddAccountForm />, { wrapper: createWrapper() });

    const freshrssButton = screen.getByRole("button", { name: /FreshRSS/ });

    expect(freshrssButton).toHaveClass("rounded-md", "px-3", "py-2.5");
    expect(freshrssButton.querySelector(".lucide-chevron-right")).toHaveClass("text-foreground-soft");
  });

  it("wraps the picker in a semantic surface shell", () => {
    render(<AddAccountForm />, { wrapper: createWrapper() });

    expect(screen.getByTestId("service-picker-surface")).toHaveClass(
      "rounded-lg",
      "border",
      "border-border",
      "bg-surface-1",
      "shadow-elevation-1",
    );
  });

  it("keeps the service row and icon badge on the rounded-md baseline", () => {
    expect(servicePickerSource).toContain('className={cn("items-center rounded-md px-3 py-2.5")}');
    expect(servicePickerSource).toContain('"flex size-9 shrink-0 items-center justify-center rounded-md"');
    expect(servicePickerSource).toContain("size-4.5");
    expect(servicePickerSource).toContain("service.iconBg");
    expect(accountConfigFormViewSource).toContain(
      'className={cn("flex size-10 shrink-0 items-center justify-center rounded-md", serviceSummary.iconBg)}',
    );
    expect(accountConfigFormViewSource).toContain("size-5");
  });

  it("keeps the config controller focused on view props and submit effects", () => {
    expect(accountConfigFormSource).toContain("AccountConfigFormView");
    expect(accountConfigFormSource).not.toContain("<form");
    expect(accountConfigFormSource).not.toContain("SurfaceCard");
  });

  it("navigates to config form on service selection and back", async () => {
    const user = userEvent.setup();
    render(<AddAccountForm />, { wrapper: createWrapper() });

    await selectService(user, "FreshRSS");

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Server URL")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Back/ })).toHaveClass("text-foreground-soft");
    expect(screen.getByText("freshrss.org")).toHaveClass("text-foreground-soft");
    expect(screen.getByLabelText("Name")).toHaveClass("w-full");
    expect(screen.getByLabelText("Server URL")).toHaveClass("w-full");
    expect(screen.getByLabelText("Server URL")).toHaveClass("h-10");
    expect(screen.getByLabelText("Username")).toHaveClass("h-10");
    expect(screen.getByLabelText("Password")).toHaveClass("h-10");
    expect(screen.getByText("Server URL")).toHaveClass("sm:w-40");

    await user.click(screen.getByRole("button", { name: /Back/ }));

    await waitFor(() => {
      expect(screen.getByText("Local Feeds")).toBeInTheDocument();
    });
  });

  it("does not navigate to the config form when a planned service is clicked", async () => {
    const user = userEvent.setup();
    render(<AddAccountForm />, { wrapper: createWrapper() });

    await user.click(screen.getByRole("button", { name: /Feedly/ }));

    expect(screen.getByText("Local Feeds")).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });

  it("keeps FreshRSS submit disabled until required connection fields are valid", async () => {
    let addAccountCalls = 0;
    setupTauriMocks((cmd) => {
      if (cmd === "add_account") {
        addAccountCalls += 1;
      }
      return null;
    });

    const user = userEvent.setup();
    render(<AddAccountForm />, { wrapper: createWrapper() });

    await selectService(user, "FreshRSS");
    expect(screen.queryByText("Local Feeds")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Server URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    const serverUrlInput = screen.getByLabelText("Server URL");

    await user.type(serverUrlInput, "https://freshrss.example.com");
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    const usernameInput = screen.getByLabelText("Username");
    expect(usernameInput).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById(usernameInput.getAttribute("aria-errormessage") ?? "")).toHaveTextContent(
      "Username is required",
    );

    await user.type(usernameInput, "alice");
    expect(usernameInput).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById(passwordInput.getAttribute("aria-errormessage") ?? "")).toHaveTextContent(
      "Password is required",
    );

    await user.type(passwordInput, "secret");
    expect(passwordInput).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("button", { name: "Add" })).not.toBeDisabled();
    expect(addAccountCalls).toBe(0);
  });

  it("shows FreshRSS server URL validation while editing", async () => {
    const user = userEvent.setup();
    render(<AddAccountForm />, { wrapper: createWrapper() });

    await selectService(user, "FreshRSS");
    const serverUrlInput = screen.getByLabelText("Server URL");

    await user.type(serverUrlInput, "not a url");

    expect(serverUrlInput).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById(serverUrlInput.getAttribute("aria-errormessage") ?? "")).toHaveTextContent(
      "Enter a valid server URL",
    );
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("shows network error toast when connection to FreshRSS server fails", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "add_account") {
        throw {
          type: "Retryable",
          message: "Network error: connection refused",
        };
      }
      return null;
    });

    const user = userEvent.setup();
    render(<AddAccountForm />, { wrapper: createWrapper() });

    await selectService(user, "FreshRSS");
    await user.type(screen.getByLabelText("Server URL"), "https://bad-server.example.com");
    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(useUiStore.getState().toastMessage).toEqual({
        message: "Cannot connect to server. Please check the URL",
      });
      expect(useUiStore.getState().accountSetupSession).toBeNull();
    });
  });

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
    await user.type(screen.getByLabelText("Server URL"), "https://freshrss.example.com");
    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      const toast = useUiStore.getState().toastMessage;
      expect(toast?.message).toContain("Authentication failed");
      expect(toast?.message).toContain("API password");
      expect(useUiStore.getState().accountSetupSession).toBeNull();
    });
  });

  it("shows 'Testing connection…' button text while submitting FreshRSS account", async () => {
    const addAccount = setupPendingAddAccount();

    const user = userEvent.setup();
    render(<AddAccountForm />, { wrapper: createWrapper() });

    await selectService(user, "FreshRSS");
    await user.type(screen.getByLabelText("Server URL"), "https://freshrss.example.com");
    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(useUiStore.getState().accountSetupSession).toEqual({
        owner: "add-account",
        state: "verifying",
      });
    });
    expect(screen.getByRole("button", { name: "Testing connection…" })).toBeDisabled();

    addAccount.resolve({
      ...sampleAccounts[1],
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

  it("submits Local account and disables controls while the request is pending", async () => {
    const addAccountCalls = vi.fn();
    const addAccount = setupPendingAddAccount(addAccountCalls);

    const user = userEvent.setup();
    render(<AddAccountForm />, { wrapper: createWrapper() });

    await selectService(user, "Local Feeds");
    await user.type(screen.getByLabelText("Name"), "Work RSS");
    await user.keyboard("{Enter}");

    const addButton = screen.getByRole("button", { name: "Adding…" });
    expect(addAccountCalls).toHaveBeenCalledTimes(1);
    expect(addButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByLabelText("Name")).toBeDisabled();

    addAccount.resolve({
      ...sampleAccounts[0],
      id: "acc-new",
      kind: "Local",
      name: "Work RSS",
      server_url: null,
      sync_interval_secs: 3600,
      sync_on_wake: false,
      keep_read_items_days: 30,
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add" })).not.toBeDisabled();
    });
  });

  it("does not submit Local account twice while the first submit is pending", async () => {
    const addAccountCalls = vi.fn();
    const addAccount = setupPendingAddAccount(addAccountCalls);

    const user = userEvent.setup();
    render(<AddAccountForm />, { wrapper: createWrapper() });

    await selectService(user, "Local Feeds");
    await user.type(screen.getByLabelText("Name"), "Work RSS");
    await user.dblClick(screen.getByRole("button", { name: "Add" }));
    await user.keyboard("{Enter}");

    expect(addAccountCalls).toHaveBeenCalledTimes(1);

    addAccount.resolve({
      ...sampleAccounts[0],
      id: "acc-new",
      kind: "Local",
      name: "Work RSS",
      server_url: null,
      sync_interval_secs: 3600,
      sync_on_wake: false,
      keep_read_items_days: 30,
    });
  });

  it("drops FreshRSS-only fields when switching providers before Local submit", async () => {
    const addAccountCalls = vi.fn();

    setupTauriMocks((cmd, args) => {
      if (cmd === "add_account") {
        addAccountCalls(args);
        return {
          ...sampleAccounts[0],
          id: "acc-local",
          kind: "Local",
          name: "Local",
          server_url: null,
          sync_interval_secs: 3600,
          sync_on_startup: true,
          sync_on_wake: false,
          keep_read_items_days: 30,
        };
      }
      if (cmd === "trigger_sync_account") {
        return new Promise(() => {});
      }
      return null;
    });

    const user = userEvent.setup();
    render(<AddAccountForm />, { wrapper: createWrapper() });

    await selectService(user, "FreshRSS");
    await user.type(screen.getByLabelText("Name"), "Work RSS");
    await user.type(screen.getByLabelText("Server URL"), "https://freshrss.example.com");
    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: /Back/ }));
    await selectService(user, "Local Feeds");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(addAccountCalls).toHaveBeenCalledWith({
        kind: "Local",
        name: "Local",
      });
    });
  });

  it("ignores add account success after switching away from the provider snapshot", async () => {
    const addAccount = setupPendingAddAccount();
    const user = userEvent.setup();

    const { unmount } = render(<AddAccountForm />, {
      wrapper: createWrapper(),
    });

    await selectService(user, "FreshRSS");
    await user.type(screen.getByLabelText("Name"), "Work RSS");
    await user.type(screen.getByLabelText("Server URL"), "https://freshrss.example.com");
    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(useUiStore.getState().accountSetupSession).toEqual({
        owner: "add-account",
        state: "verifying",
      });
    });

    unmount();
    useUiStore.getState().openSettingsAccount("acc-existing");

    addAccount.resolve({
      ...sampleAccounts[1],
      id: "acc-stale",
      kind: "FreshRss",
      name: "FreshRSS",
      username: "alice",
      server_url: "https://freshrss.example.com",
      sync_interval_secs: 3600,
      sync_on_startup: true,
      sync_on_wake: false,
      keep_read_items_days: 30,
    });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Testing connection…" })).not.toBeInTheDocument();
    });
    expect(useUiStore.getState().selectedAccountId).not.toBe("acc-stale");
    expect(useUiStore.getState().settingsAccountId).toBe("acc-existing");
    expect(useUiStore.getState().accountSetupSession).toBeNull();
  });

  it("does not let stale setup sync completion override later navigation", async () => {
    const user = userEvent.setup();
    let releaseSync = () => {};

    setupTauriMocks((cmd) => {
      if (cmd === "add_account") {
        return {
          ...sampleAccounts[1],
          id: "acc-new",
          kind: "FreshRss",
          name: "FreshRSS",
          username: "alice",
          server_url: "https://freshrss.example.com",
          sync_interval_secs: 3600,
          sync_on_startup: true,
          sync_on_wake: false,
          keep_read_items_days: 30,
        };
      }
      if (cmd === "trigger_sync_account") {
        return new Promise((resolve) => {
          releaseSync = () =>
            resolve({
              synced: true,
              total: 1,
              succeeded: 1,
              failed: [],
              warnings: [],
            });
        });
      }
      return null;
    });

    render(<AddAccountForm />, { wrapper: createWrapper() });

    await selectService(user, "FreshRSS");
    await user.type(screen.getByLabelText("Server URL"), "https://freshrss.example.com");
    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(useUiStore.getState().accountSetupSession).toEqual({
        accountId: "acc-new",
        owner: "add-account",
        state: "syncing",
      });
    });

    useUiStore.getState().openSettingsAccount("acc-existing");
    releaseSync();

    await waitFor(() => {
      expect(useUiStore.getState().accountSetupSession).toBeNull();
    });
    expect(useUiStore.getState().selectedAccountId).toBe("acc-new");
    expect(useUiStore.getState().settingsAccountId).toBe("acc-existing");
    expect(useUiStore.getState().settingsOpen).toBe(true);
  });

  it("keeps setup sync ownership stable across duplicate submit, navigation away, rejection, and retry", async () => {
    const user = userEvent.setup();
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    let rejectSetupSync = (_error: unknown) => {};
    let resolveSetupSync = (_value: unknown) => {};

    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      if (cmd === "add_account") {
        return {
          ...sampleAccounts[1],
          id: "acc-new",
          kind: "FreshRss",
          name: "FreshRSS",
          username: "alice",
          server_url: "https://freshrss.example.com",
          sync_interval_secs: 3600,
          sync_on_startup: true,
          sync_on_wake: false,
          keep_read_items_days: 30,
        };
      }

      if (cmd === "trigger_sync_account") {
        return new Promise((resolve, reject) => {
          rejectSetupSync = reject;
          resolveSetupSync = resolve;
        });
      }

      return null;
    });

    const { unmount } = render(<AddAccountForm />, {
      wrapper: createWrapper(),
    });

    await selectService(user, "FreshRSS");
    await user.type(screen.getByLabelText("Server URL"), "https://freshrss.example.com");
    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.dblClick(screen.getByRole("button", { name: "Add" }));
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(calls.filter((call) => call.cmd === "add_account")).toHaveLength(1);
      expect(calls.filter((call) => call.cmd === "trigger_sync_account")).toHaveLength(1);
      expect(useUiStore.getState().accountSetupSession).toEqual({
        accountId: "acc-new",
        owner: "add-account",
        state: "syncing",
      });
    });

    unmount();
    rejectSetupSync(new Error("setup sync failed"));

    await waitFor(() => {
      expect(useUiStore.getState().accountSetupSession).toEqual({
        accountId: "acc-new",
        owner: "add-account",
        state: "failed",
        errorMessage: "account.sync_failed",
      });
    });

    const retry = runAccountSetupSync({
      accountId: "acc-new",
      queryClient: createQueryWrapper().queryClient,
      t: i18n.getFixedT("en", "settings"),
      owner: "add-account",
    });

    await waitFor(() => {
      expect(calls.filter((call) => call.cmd === "trigger_sync_account")).toHaveLength(2);
    });
    resolveSetupSync({
      synced: true,
      total: 1,
      succeeded: 1,
      failed: [],
      warnings: [],
    });
    await retry;

    await waitFor(() => {
      expect(useUiStore.getState().accountSetupSession).toBeNull();
    });
  });

  it("starts an account setup session after successful registration", async () => {
    const user = userEvent.setup();
    let releaseSync = () => {};

    setupTauriMocks((cmd) => {
      if (cmd === "add_account") {
        return {
          ...sampleAccounts[1],
          id: "acc-new",
          kind: "FreshRss",
          name: "FreshRSS",
          username: "alice",
          server_url: "https://freshrss.example.com",
          sync_interval_secs: 3600,
          sync_on_startup: true,
          sync_on_wake: false,
          keep_read_items_days: 30,
        };
      }
      if (cmd === "trigger_sync_account") {
        return new Promise((resolve) => {
          releaseSync = () =>
            resolve({
              synced: true,
              total: 1,
              succeeded: 1,
              failed: [],
              warnings: [],
            });
        });
      }
      return null;
    });

    render(<AddAccountForm />, { wrapper: createWrapper() });

    await selectService(user, "FreshRSS");
    await user.type(screen.getByLabelText("Server URL"), "https://freshrss.example.com");
    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(useUiStore.getState().selectedAccountId).toBe("acc-new");
      expect(useUiStore.getState().settingsAccountId).toBe("acc-new");
      expect(useUiStore.getState().accountSetupSession).toEqual({
        accountId: "acc-new",
        owner: "add-account",
        state: "syncing",
      });
    });

    releaseSync();
  });

  it("adds the new account to the accounts query cache immediately after registration", async () => {
    const user = userEvent.setup();
    const { queryClient, wrapper } = createQueryWrapper();

    setupTauriMocks((cmd) => {
      if (cmd === "add_account") {
        return {
          ...sampleAccounts[1],
          id: "acc-new",
          kind: "FreshRss",
          name: "FreshRSS",
          username: "alice",
          server_url: "https://freshrss.example.com",
          sync_interval_secs: 3600,
          sync_on_startup: true,
          sync_on_wake: false,
          keep_read_items_days: 30,
        };
      }
      if (cmd === "trigger_sync_account") {
        return new Promise(() => {});
      }
      return null;
    });

    render(<AddAccountForm />, { wrapper });

    await selectService(user, "FreshRSS");
    await user.type(screen.getByLabelText("Server URL"), "https://freshrss.example.com");
    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(queryClient?.getQueryData(queryKeys.accounts.root)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "acc-new",
            name: "FreshRSS",
          }),
        ]),
      );
    });
  });

  it("keeps the created account selected when post-success invalidation fails", async () => {
    const user = userEvent.setup();
    const { queryClient, wrapper } = createQueryWrapper();
    const invalidationError = new Error("cache refresh failed");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(queryClient, "invalidateQueries").mockRejectedValue(invalidationError);

    setupTauriMocks((cmd) => {
      if (cmd === "add_account") {
        return {
          ...sampleAccounts[1],
          id: "acc-new",
          kind: "FreshRss",
          name: "FreshRSS",
          username: "alice",
          server_url: "https://freshrss.example.com",
          sync_interval_secs: 3600,
          sync_on_startup: true,
          sync_on_wake: false,
          keep_read_items_days: 30,
        };
      }
      if (cmd === "trigger_sync_account") {
        return new Promise(() => {});
      }
      return null;
    });

    render(<AddAccountForm />, { wrapper });

    await selectService(user, "FreshRSS");
    await user.type(screen.getByLabelText("Server URL"), "https://freshrss.example.com");
    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(useUiStore.getState().selectedAccountId).toBe("acc-new");
      expect(useUiStore.getState().settingsAccountId).toBe("acc-new");
      expect(useUiStore.getState().accountSetupSession).toEqual({
        accountId: "acc-new",
        owner: "add-account",
        state: "syncing",
      });
    });
    await waitFor(() => {
      expect(warn).toHaveBeenCalledWith("Query invalidation failed:", {
        failures: expect.arrayContaining([
          expect.objectContaining({
            actionOwner: "unknown",
            queryKey: queryKeys.accounts.root,
            error: invalidationError,
          }),
        ]),
      });
    });
  });
});
