import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { DiscoveredFeedOptionsView } from "./discovered-feed-options-view";

const meta = {
  title: "Reader/DiscoveredFeedOptionsView",
  component: DiscoveredFeedOptionsView,
  tags: ["autodocs"],
  args: {
    summary: "Found 3 feeds",
    name: "discovered-feed",
    value: "https://example.com/feed.xml",
    options: [
      { value: "https://example.com/feed.xml", label: "Tech Blog" },
      { value: "https://example.com/atom.xml", label: "News Feed" },
      { value: "https://example.com/podcast.xml", label: "Podcast Feed" },
    ],
    onValueChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-[420px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DiscoveredFeedOptionsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongLabels: Story = {
  args: {
    options: [
      {
        value: "https://example.com/feeds/engineering.xml",
        label: "Engineering Updates and Product Release Notes",
      },
      {
        value: "https://example.com/feeds/research.xml",
        label: "Research Weekly Digest and Deep Dives",
      },
    ],
  },
};
