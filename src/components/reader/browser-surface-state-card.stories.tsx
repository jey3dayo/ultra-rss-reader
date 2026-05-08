import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { BrowserSurfaceStateCard } from "./browser-surface-state-card";

const meta = {
  title: "Reader/Browser/BrowserSurfaceStateCard",
  component: BrowserSurfaceStateCard,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="min-h-[240px] bg-browser-overlay-shell p-6 text-foreground">
        <div className="flex min-h-[188px] items-center justify-center rounded-xl border border-border/35 bg-surface-2/80 p-6">
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    issue: {
      kind: "failed",
      title: "Web Preview could not load.",
      description: "Try again or open this page externally.",
      detail:
        "Navigation timed out while creating the embedded browser surface.",
      canRetry: true,
    },
    showTechnicalDetail: true,
    onRetry: fn(),
    onOpenExternal: fn(),
    labels: {
      technicalDetail: "Technical detail",
      retryWebPreview: "Retry Web Preview",
      openInExternalBrowser: "Open in External Browser",
    },
  },
} satisfies Meta<typeof BrowserSurfaceStateCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RetryableIssue: Story = {};

export const RuntimeUnavailableIssue: Story = {
  args: {
    issue: {
      kind: "unsupported",
      title: "Embedded Web Preview is unavailable in this runtime.",
      description:
        "Use the desktop app to inspect the embedded preview, or open the page externally.",
      detail: null,
      canRetry: false,
    },
    showTechnicalDetail: false,
  },
};
