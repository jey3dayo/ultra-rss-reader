import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AccountCredentialsSectionView } from "./credentials-section-view";

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
    testConnectionLabel: "Test Connection",
    testingConnectionLabel: "Testing…",
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

export const CloudflareAccessConfigured: Story = {
  args: {
    cloudflareAccess: {
      status: "ready",
      loadingMessage: "Checking Cloudflare Access settings…",
      readErrorMessage: "Cloudflare Access settings could not be read. Existing credentials will be kept unchanged.",
      unavailableMessage: "Cloudflare Access settings can only be managed in the desktop app.",
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

export const JapaneseNarrow: Story = {
  args: {
    serverUrlLabel: "サーバーURL",
    usernameLabel: "ユーザー名",
    passwordLabel: "パスワード",
    passwordPlaceholder: "新しいパスワードを入力",
    testConnectionLabel: "接続テスト",
    testingConnectionLabel: "テスト中…",
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[520px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
};
