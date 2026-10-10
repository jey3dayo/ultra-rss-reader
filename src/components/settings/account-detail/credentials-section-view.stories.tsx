import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { AccountCredentialsSectionView } from "./credentials-section-view";

async function openCloudflareAccessHelp(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { name: "About Cloudflare Access" }));
  const dialog = await within(document.body).findByRole("dialog", { name: "Cloudflare Access" });
  await expect(dialog).toBeVisible();
}

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
  },
};

export const SetupFailedDirtyDraft: Story = {
  args: {
    note: "Setup failed",
    serverUrlValue: "https://new.freshrss.example.com/api/greader.php",
    testConnectionLabel: "Save & Test Connection",
  },
};

export const CloudflareAccessConfigured: Story = {
  args: {
    cloudflareAccess: {
      status: "ready",
      loadingMessage: "Checking Cloudflare Access settings…",
      readErrorMessage: "Cloudflare Access settings could not be read. Existing credentials will be kept unchanged.",
      unavailableMessage: "Cloudflare Access settings can only be managed in the desktop app.",
      authorizationRequiredMessage: "Choose Save and test connection to load Cloudflare Access settings.",
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
        placeholder: "Leave blank to keep the saved Secret",
        onChange: fn(),
        onBlur: fn(),
      },
      clientIdError: "Enter a Cloudflare Access Client ID",
      clientSecretError: "Enter a Client Secret when changing the Client ID or server origin",
      validationError: null,
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
