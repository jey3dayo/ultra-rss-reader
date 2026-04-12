import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { CopyableReadonlyFieldList } from "./copyable-readonly-field-list";

const meta = {
  title: "Shared/CopyableReadonlyFieldList",
  component: CopyableReadonlyFieldList,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="max-w-md p-6">
        <Story />
      </div>
    ),
  ],
  args: {
    fields: [
      {
        key: "website-url",
        label: "Website URL",
        name: "website-url",
        value: "https://example.com",
        copyLabel: "Copy website URL",
        onCopy: fn(),
      },
      {
        key: "feed-url",
        label: "Feed URL",
        name: "feed-url",
        value: "https://example.com/feed.xml",
        copyLabel: "Copy feed URL",
        onCopy: fn(),
      },
    ],
  },
} satisfies Meta<typeof CopyableReadonlyFieldList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Plain: Story = {};

export const CardSurface: Story = {
  args: {
    className: "rounded-xl border border-border bg-card px-4 py-4",
  },
};
