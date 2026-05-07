import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { fn } from "storybook/test";
import { useUiStore } from "@/stores/ui-store";
import { ArticleToolbarView } from "./article-toolbar-view";

const meta = {
  title: "Reader/Article/ArticleToolbarView",
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

const mobileDecorator: Decorator = (Story) => {
  useEffect(() => {
    useUiStore.setState({ layoutMode: "mobile" });
    return () => useUiStore.setState({ layoutMode: "wide" });
  }, []);

  return <Story />;
};

function MobileInteractiveToolbar(args: Story["args"]) {
  const [isRead, setIsRead] = useState(args?.isRead ?? false);
  const [isStarred, setIsStarred] = useState(args?.isStarred ?? false);
  const [isBrowserOpen, setIsBrowserOpen] = useState(args?.isBrowserOpen ?? false);

  return (
    <ArticleToolbarView
      {...meta.args}
      {...args}
      isRead={isRead}
      isStarred={isStarred}
      isBrowserOpen={isBrowserOpen}
      onToggleRead={setIsRead}
      onToggleStar={setIsStarred}
      onOpenInBrowser={() => setIsBrowserOpen((current) => !current)}
    />
  );
}

export const Default: Story = {
  args: {
    isBrowserOpen: false,
  },
};

export const MobileDefault: Story = {
  args: {
    isBrowserOpen: false,
  },
  decorators: [mobileDecorator],
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const MobileInteractive: Story = {
  args: {
    isRead: false,
    isStarred: false,
    isBrowserOpen: false,
  },
  decorators: [mobileDecorator],
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
  render: (args) => <MobileInteractiveToolbar {...args} />,
};

export const MobilePreviewOpen: Story = {
  args: {
    isBrowserOpen: true,
    showCloseButton: false,
  },
  decorators: [mobileDecorator],
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const MobileDisabledActions: Story = {
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
  decorators: [mobileDecorator],
  parameters: {
    viewport: { defaultViewport: "mobile1" },
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
