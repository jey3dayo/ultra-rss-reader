import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AccountGeneralSectionView } from "./account-general-section-view";

const meta = {
  title: "Settings/AccountGeneralSectionView",
  component: AccountGeneralSectionView,
  tags: ["autodocs"],
  args: {
    heading: "General",
    nameLabel: "Description",
    nameValue: "Personal FreshRSS",
    editNameTitle: "Click to edit",
    isEditingName: false,
    nameDraft: "Personal FreshRSS",
    infoRows: [
      { label: "Type", value: "FreshRSS" },
      { label: "Server", value: "https://freshrss.example.com", truncate: true },
    ],
    onStartEditingName: fn(),
    onNameDraftChange: fn(),
    onCommitName: fn(),
    onNameKeyDown: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-[420px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccountGeneralSectionView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Editing: Story = {
  args: {
    isEditingName: true,
  },
};
