import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { MuteSettingsView, type MuteSettingsViewProps } from "./mute-settings-view";

const scopeOptions: MuteSettingsViewProps["scopeOptions"] = [
  { value: "title", label: "Title" },
  { value: "body", label: "Body" },
  { value: "title_and_body", label: "Title and body" },
];

const meta = {
  title: "Settings/Category/MuteSettingsView",
  component: MuteSettingsView,
  tags: ["autodocs"],
  args: {
    title: "Mute",
    addHeading: "Add keyword",
    intro: "Hide articles that match words you do not want to see.",
    keywordLabel: "Keyword",
    keywordValue: "spoiler",
    keywordPlaceholder: "Keyword or phrase",
    scopeAriaLabel: "Mute scope",
    scopeValue: "title",
    scopeOptions,
    addLabel: "Add",
    onKeywordChange: fn(),
    onScopeChange: fn(),
    onAdd: fn(),
    addDisabled: false,
    savedHeading: "Saved keywords",
    emptyState: "No muted keywords yet.",
    rules: [
      { id: "rule-1", keyword: "spoiler", scope: "title" },
      { id: "rule-2", keyword: "launch rumor", scope: "title_and_body" },
    ],
    savedScopeAriaLabel: (keyword: string) => `Scope for ${keyword}`,
    onRuleScopeChange: fn(),
    deleteLabel: "Delete",
    onRequestDelete: fn(),
    autoMarkReadHeading: "Auto mark as read",
    autoMarkReadLabel: "Mark muted articles as read",
    autoMarkReadChecked: true,
    autoMarkReadDisabled: false,
    autoMarkReadHint: "Muted articles can be removed from unread counts automatically.",
    onAutoMarkReadChange: fn(),
    confirmOpen: false,
    confirmMessage: "Delete this muted keyword?",
    confirmActionLabel: "Delete keyword",
    cancelLabel: "Cancel",
    onConfirmDelete: fn(),
    onCancelDelete: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[520px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MuteSettingsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    keywordValue: "",
    addDisabled: true,
    rules: [],
    autoMarkReadChecked: false,
  },
};

export const ConfirmingDelete: Story = {
  args: {
    confirmOpen: true,
  },
};
