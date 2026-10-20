import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { AccountCloudflareAccessSection } from "./cloudflare-access-credential-fields";
import { AccountCredentialsSectionView } from "./credentials-section-view";

async function openCloudflareAccessHelp(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { name: "About Cloudflare Access" }));
  const dialog = await within(document.body).findByRole("dialog", { name: "Cloudflare Access" });
  await expect(dialog).toBeVisible();
}

const configuredCloudflareAccess = {
  status: "ready",
  hasSavedSecret: true,
  secretEditing: false,
  secretVisible: false,
  secretDescription:
    "Leave blank to keep the saved Secret. Changing the Client ID or server origin requires a new Secret. The saved Secret is never shown here.",
  secretSavedLabel: "Saved",
  secretChangeLabel: "Change",
  secretChangeAriaLabel: "Change saved Client Secret",
  secretCancelLabel: "Cancel",
  secretShowLabel: "Show new Secret",
  secretHideLabel: "Hide new Secret",
  onSecretEditingChange: fn(),
  onSecretVisibilityChange: fn(),
  loadingMessage: "Checking Cloudflare Access settings…",
  readErrorMessage: "Cloudflare Access settings could not be read. Existing credentials will be kept unchanged.",
  unavailableMessage: "Cloudflare Access settings can only be managed in the desktop app.",
  authorizationRequiredMessage: "Run the connection test to load Access settings.",
  label: "Cloudflare Access",
  description: "Add Access authentication",
  enabled: true,
  onEnabledChange: fn(),
  clientId: {
    label: "Client ID",
    value: "demo-client-id",
    placeholder: "Cloudflare Access Client ID",
    onChange: fn(),
    onBlur: fn(),
  },
  clientSecret: {
    label: "Client Secret",
    value: "",
    placeholder: "New Client Secret",
    onChange: fn(),
    onBlur: fn(),
  },
  clientIdError: "Enter a Cloudflare Access Client ID",
  clientSecretError: "Enter a Client Secret when changing the Client ID or server origin",
  validationError: null,
} satisfies AccountCloudflareAccessSection;

const meta = {
  title: "Settings/Section/AccountCredentialsSectionView",
  component: AccountCredentialsSectionView,
  tags: ["autodocs"],
  args: {
    heading: "Server",
    serverUrlLabel: "Server URL",
    serverUrlValue: "https://demo.freshrss.example.com/api/greader.php",
    serverUrlPlaceholder: "https://your-freshrss.com",
    serverUrlCopyLabel: "Copy Server URL",
    usernameLabel: "Username",
    usernameValue: "debug",
    passwordLabel: "Password",
    passwordValue: "",
    passwordPlaceholder: "Enter new password",
    testConnectionLabel: "Check Connection",
    testingConnectionLabel: "Checking…",
    onServerUrlChange: fn(),
    onServerUrlBlur: fn(),
    onServerUrlCopy: fn(),
    onUsernameChange: fn(),
    onUsernameBlur: fn(),
    onPasswordChange: fn(),
    onPasswordFocus: fn(),
    onPasswordBlur: fn(),
    onTestConnection: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[640px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccountCredentialsSectionView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SavedPassword: Story = {
  args: {
    passwordValue: "••••••••",
  },
};

export const DirtyDraft: Story = {
  args: {
    serverUrlValue: "https://new.freshrss.example.com/api/greader.php",
    testConnectionLabel: "Save & Test Connection",
    changedFields: { serverUrl: true, username: false, password: false },
    changedFieldLabel: "Changed",
  },
};

export const SetupFailedDirtyDraft: Story = {
  args: {
    note: "Setup failed",
    serverUrlValue: "https://new.freshrss.example.com/api/greader.php",
    testConnectionLabel: "Save & Test Connection",
    changedFields: { serverUrl: true, username: false, password: false },
    changedFieldLabel: "Changed",
  },
};

export const DirtyDraftMultipleFields: Story = {
  args: {
    serverUrlValue: "https://new.freshrss.example.com/api/greader.php",
    usernameValue: "new-user",
    passwordValue: "new-password",
    testConnectionLabel: "Save & Test Connection",
    changedFields: { serverUrl: true, username: true, password: true },
    changedFieldLabel: "Changed",
  },
};

export const CloudflareAccessConfigured: Story = {
  args: {
    cloudflareAccess: configuredCloudflareAccess,
  },
};

export const CloudflareAccessChangingSecret: Story = {
  args: {
    cloudflareAccess: {
      ...configuredCloudflareAccess,
      secretEditing: true,
    },
  },
};

export const CloudflareAccessRevealedDraft: Story = {
  args: {
    cloudflareAccess: {
      ...configuredCloudflareAccess,
      secretEditing: true,
      secretVisible: true,
      clientSecret: { ...configuredCloudflareAccess.clientSecret, value: "new-demo-secret" },
    },
  },
};

export const CloudflareAccessConfiguredHelpOpen: Story = {
  ...CloudflareAccessConfigured,
  play: ({ canvasElement }) => openCloudflareAccessHelp(canvasElement),
};

export const CloudflareAccessConfiguredNarrow: Story = {
  ...CloudflareAccessConfigured,
  decorators: [
    (Story) => (
      <div className="w-[360px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
};

export const JapaneseNarrow: Story = {
  args: {
    serverUrlLabel: "サーバーURL",
    usernameLabel: "ユーザー名",
    passwordLabel: "パスワード",
    passwordPlaceholder: "新しいパスワードを入力",
    testConnectionLabel: "接続確認",
    testingConnectionLabel: "確認中…",
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[520px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
};
