import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { AddAccountForm, type AddAccountFormProps } from "./add-account-form";

function StoryQueryClientProvider({ children }: { children: ReactNode }) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false },
        },
      }),
    [],
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const meta = {
  title: "Settings/Page/AddAccountForm",
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
        <div
          className={
            context.viewMode === "docs"
              ? "mx-auto w-full max-w-[440px] bg-background p-4"
              : "mx-auto h-[820px] w-full max-w-[440px] overflow-auto bg-background p-4"
          }
        >
          <Story />
        </div>
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
