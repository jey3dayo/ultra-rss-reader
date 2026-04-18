import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AddAccountFormView } from "./add-account-form-view";

const meta = {
  title: "Settings/Page/AddAccountFormView",
  component: AddAccountFormView,
  tags: ["autodocs"],
  args: {
    title: "Add Account",
    accountHeading: "Account",
    accountType: {
      label: "Type",
      name: "account-type",
      value: "Local",
      options: [
        { value: "Local", label: "Local feeds" },
        { value: "FreshRSS", label: "FreshRSS" },
      ],
      onChange: fn(),
      disabled: false,
    },
    accountName: {
      label: "Name",
      name: "account-name",
      value: "Local",
      placeholder: "Local",
      onChange: fn(),
      disabled: false,
    },
    errorMessage: null,
    submitLabel: "Add",
    submittingLabel: "Adding…",
    cancelLabel: "Cancel",
    submitting: false,
    onSubmit: fn(),
    onCancel: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[420px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AddAccountFormView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LocalAccount: Story = {};

export const FreshRSSAccount: Story = {
  args: {
    accountType: {
      label: "Type",
      name: "account-type",
      value: "FreshRSS",
      options: [
        { value: "Local", label: "Local feeds" },
        { value: "FreshRSS", label: "FreshRSS" },
      ],
      onChange: fn(),
      disabled: false,
    },
    accountName: {
      label: "Name",
      name: "account-name",
      value: "Work RSS",
      placeholder: "FreshRSS",
      onChange: fn(),
      disabled: false,
    },
    credentialsSection: {
      heading: "FreshRSS",
      serverUrl: {
        label: "Server URL",
        name: "server-url",
        value: "https://freshrss.example.com",
        placeholder: "https://your-freshrss.com",
        onChange: fn(),
        disabled: false,
      },
      credential: {
        label: "Username",
        name: "username",
        value: "alice",
        onChange: fn(),
        disabled: false,
      },
      password: {
        label: "Password",
        name: "password",
        value: "secret",
        type: "password",
        onChange: fn(),
        disabled: false,
      },
    },
  },
};
