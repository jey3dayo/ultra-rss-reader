import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useEffect, useState } from "react";
import { fn } from "storybook/test";
import { useUiStore } from "@/stores/ui-store";
import { ArticleToolbarView } from "./article-toolbar-view";

const meta = {
  title: "Reader/Article/ArticleToolbarView",
  component: ArticleToolbarView,
  tags: ["autodocs"],
  args: {
    showCloseButton: true,
    articleState: {
      hasArticle: true,
      isRead: false,
      isStarred: true,
      isBrowserOpen: false,
    },
    actionOptions: {
      canToggleRead: true,
      canToggleStar: true,
      showCopyLinkButton: true,
      canCopyLink: true,
      showOpenInBrowserButton: true,
      canOpenInBrowser: true,
      showOpenInExternalBrowserButton: true,
      canOpenInExternalBrowser: true,
    },
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

function MobileLayoutModeBoundary({ children }: { children: ReactNode }) {
  useEffect(() => {
    const previousLayoutMode = useUiStore.getState().layoutMode;
    useUiStore.setState({ layoutMode: "mobile" });
    return () => useUiStore.setState({ layoutMode: previousLayoutMode });
  }, []);

  return children;
}

const mobileDecorator: Decorator = (Story) => {
  return (
    <MobileLayoutModeBoundary>
      <Story />
    </MobileLayoutModeBoundary>
  );
};

function MobileInteractiveToolbar(args: Story["args"]) {
  const [isRead, setIsRead] = useState(args?.articleState?.isRead ?? false);
  const [isStarred, setIsStarred] = useState(args?.articleState?.isStarred ?? false);
  const [isBrowserOpen, setIsBrowserOpen] = useState(args?.articleState?.isBrowserOpen ?? false);

  return (
    <ArticleToolbarView
      {...meta.args}
      {...args}
      articleState={{
        ...(args?.articleState ?? meta.args.articleState),
        isRead,
        isStarred,
        isBrowserOpen,
      }}
      onToggleRead={setIsRead}
      onToggleStar={setIsStarred}
      onOpenInBrowser={() => setIsBrowserOpen((current) => !current)}
    />
  );
}

export const Default: Story = {
  args: {
    articleState: {
      ...meta.args.articleState,
      isBrowserOpen: false,
    },
  },
};

export const MobileDefault: Story = {
  args: {
    layoutMode: "mobile",
    articleState: {
      ...meta.args.articleState,
      isBrowserOpen: false,
    },
  },
  decorators: [mobileDecorator],
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const MobileInteractive: Story = {
  args: {
    layoutMode: "mobile",
    articleState: {
      ...meta.args.articleState,
      isRead: false,
      isStarred: false,
      isBrowserOpen: false,
    },
  },
  decorators: [mobileDecorator],
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
  render: (args) => <MobileInteractiveToolbar {...args} />,
};

export const MobilePreviewOpen: Story = {
  args: {
    layoutMode: "mobile",
    showCloseButton: false,
    articleState: {
      ...meta.args.articleState,
      isBrowserOpen: true,
    },
  },
  decorators: [mobileDecorator],
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const MobileDisabledActions: Story = {
  args: {
    layoutMode: "mobile",
    showCloseButton: false,
    articleState: {
      ...meta.args.articleState,
      isBrowserOpen: false,
    },
    actionOptions: {
      ...meta.args.actionOptions,
      canToggleRead: false,
      canToggleStar: false,
      canCopyLink: false,
      canOpenInBrowser: false,
      showOpenInExternalBrowserButton: false,
      canOpenInExternalBrowser: false,
    },
  },
  decorators: [mobileDecorator],
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const PreviewOpen: Story = {
  args: {
    showCloseButton: false,
    articleState: {
      ...meta.args.articleState,
      isBrowserOpen: true,
    },
  },
};

export const DisabledActions: Story = {
  args: {
    showCloseButton: false,
    articleState: {
      ...meta.args.articleState,
      isBrowserOpen: false,
    },
    actionOptions: {
      ...meta.args.actionOptions,
      canToggleRead: false,
      canToggleStar: false,
      canCopyLink: false,
      canOpenInBrowser: false,
      showOpenInExternalBrowserButton: false,
      canOpenInExternalBrowser: false,
    },
  },
};
