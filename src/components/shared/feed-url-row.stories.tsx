import type { Meta, StoryObj } from "@storybook/react-vite";
import { Globe, Rss } from "lucide-react";
import { fn } from "storybook/test";
import { FeedUrlRow } from "./feed-url-row";

const meta = {
  title: "Shared/Data Display/FeedUrlRow",
  component: FeedUrlRow,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
  args: {
    label: "フィードURL",
    value: "https://example.com/feed.xml",
    icon: Rss,
    copyLabel: "フィードURLをコピー",
    onCopy: fn(),
  },
} satisfies Meta<typeof FeedUrlRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PlainLabel: Story = {};

export const LinkedLabel: Story = {
  args: {
    label: "サイトURL",
    value: "https://example.com/",
    icon: Globe,
    href: "https://example.com/",
    copyLabel: "サイトURLをコピー",
  },
};

export const EmptyValue: Story = {
  args: {
    value: "",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
