import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AccountCredentialsSectionView } from "./account-credentials-section-view";

const meta = {
  title: "Settings/Section/AccountCredentialsSectionView",
  component: AccountCredentialsSectionView,
  tags: ["autodocs"],
  args: {
    heading: "Server",
    serverUrlLabel: "Server URL",
    serverUrlValue: "http://jey3dayo.asuscomm.com:5556/api/greader.php",
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
