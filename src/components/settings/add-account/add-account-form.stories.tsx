import type { Meta, StoryObj } from "@storybook/react-vite";
import { SettingsNamespaceBoundary } from "@/components/storybook/settings-namespace-boundary";
import { StoryQueryClientProvider } from "@/components/storybook/story-query-client-provider";
import { AddAccountForm, type AddAccountFormProps } from "./controller";

const meta = {
  title: "Settings/Account/AddAccountForm",
  component: AddAccountForm,
  tags: ["autodocs"],
  args: {
    debugState: {
      submitMessage: "Storybook preview does not submit real accounts. Use the desktop app to test registration.",
    },
  },
  decorators: [
    (Story, context) => (
      <StoryQueryClientProvider>
        <SettingsNamespaceBoundary>
          <div
            className={
              context.viewMode === "docs"
                ? "mx-auto w-full max-w-[440px] bg-background p-4"
                : "mx-auto h-[820px] w-full max-w-[440px] overflow-auto bg-background p-4"
            }
          >
            <Story />
          </div>
        </SettingsNamespaceBoundary>
      </StoryQueryClientProvider>
    ),
  ],
} satisfies Meta<AddAccountFormProps>;

export default meta;
type Story = StoryObj<AddAccountFormProps>;

export const ServicePicker: Story = {};

export const FreshRSSConfig: Story = {
  args: {
    initialKind: "FreshRss",
  },
};

export const FreshRSSWithCloudflareAccess: Story = {
  args: {
    initialKind: "FreshRss",
    debugState: {
      name: "Work RSS",
      serverUrl: "https://freshrss.example.com",
      username: "alice",
      cloudflareAccessEnabled: true,
      cloudflareAccessClientId: "demo-client-id",
    },
  },
};

export const FreshRSSLoading: Story = {
  args: {
    initialKind: "FreshRss",
    debugState: {
      submitMessage: "Storybook preview does not submit real accounts. Use the desktop app to test registration.",
      name: "Work RSS",
      serverUrl: "https://freshrss.example.com",
      username: "alice",
      password: "secret",
      submitting: true,
    },
  },
};
