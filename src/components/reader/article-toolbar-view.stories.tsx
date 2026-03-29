import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ArticleToolbarView } from "./article-toolbar-view";
import { DisplayModeToggleGroup } from "./display-mode-toggle-group";

const meta = {
  title: "Reader/ArticleToolbarView",
  component: ArticleToolbarView,
  tags: ["autodocs"],
  args: {
    showCloseButton: true,
    canToggleRead: true,
    canToggleStar: true,
    isRead: false,
    isStarred: true,
    showCopyLinkButton: true,
    canCopyLink: true,
    showOpenInBrowserButton: true,
    canOpenInBrowser: true,
    showOpenInExternalBrowserButton: true,
    canOpenInExternalBrowser: true,
    displayModeControl: <DisplayModeToggleGroup value="normal" onValueChange={fn()} />,
    labels: {
      closeView: "Close view",
      toggleRead: "Toggle read",
      toggleStar: "Toggle star",
      copyLink: "Copy link",
      viewInBrowser: "View in browser",
      openInExternalBrowser: "Open in external browser",
    },
    onCloseView: fn(),
    onToggleRead: fn(),
    onToggleStar: fn(),
    onCopyLink: fn(),
    onOpenInBrowser: fn(),
    onOpenInExternalBrowser: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-full bg-background">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ArticleToolbarView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DisabledActions: Story = {
  args: {
    showCloseButton: false,
    canToggleRead: false,
    canToggleStar: false,
    showCopyLinkButton: false,
    canCopyLink: false,
    showOpenInBrowserButton: false,
    canOpenInBrowser: false,
    showOpenInExternalBrowserButton: false,
    canOpenInExternalBrowser: false,
    displayModeControl: <DisplayModeToggleGroup value="widescreen" onValueChange={fn()} disabled={true} />,
  },
};
