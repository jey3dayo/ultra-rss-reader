import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ArticleToolbarView } from "./article-toolbar-view";

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
    isBrowserOpen: false,
    showCopyLinkButton: true,
    canCopyLink: true,
    showOpenInBrowserButton: true,
    canOpenInBrowser: true,
    showOpenInExternalBrowserButton: true,
    canOpenInExternalBrowser: true,
    labels: {
      closeView: "Close view",
      toggleRead: "Toggle read",
      toggleStar: "Toggle star",
      previewToggleOff: "Open Web Preview",
      previewToggleOn: "Close Web Preview",
      copyLink: "Copy link",
      openInExternalBrowser: "Open in external browser",
      moreActions: "More actions",
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

export const Default: Story = {
  args: {
    isBrowserOpen: false,
  },
};

export const PreviewOpen: Story = {
  args: {
    isBrowserOpen: true,
    showCloseButton: false,
  },
};

export const DisabledActions: Story = {
  args: {
    showCloseButton: false,
    canToggleRead: false,
    canToggleStar: false,
    isBrowserOpen: false,
    canCopyLink: false,
    canOpenInBrowser: false,
    showOpenInExternalBrowserButton: false,
    canOpenInExternalBrowser: false,
  },
};
