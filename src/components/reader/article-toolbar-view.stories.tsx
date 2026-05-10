import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useEffect, useState } from "react";
import { fn } from "storybook/test";
import { denseNarrowViewportParameters } from "@/components/storybook/viewport-fixtures";
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
      toggleReadShort: "Read",
      toggleStar: "Toggle star",
      toggleStarShort: "Star",
      previewToggleOff: "Open Web Preview",
      previewToggleOffShort: "Preview",
      previewToggleOn: "Close Web Preview",
      previewToggleOnShort: "Close",
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

export const MobileJapaneseLongLabels: Story = {
  args: {
    layoutMode: "mobile",
    articleState: {
      ...meta.args.articleState,
      isRead: false,
      isStarred: true,
      isBrowserOpen: false,
    },
    labels: {
      closeView: "記事ビューを閉じる",
      toggleRead: "この記事を既読または未読に切り替える",
      toggleReadShort: "未読にする",
      toggleStar: "この記事にスターを付けるまたは外す",
      toggleStarShort: "スター付き",
      previewToggleOff: "Webプレビューを開く",
      previewToggleOffShort: "プレビューを開く",
      previewToggleOn: "Webプレビューを閉じる",
      previewToggleOnShort: "閉じる",
      copyLink: "記事のリンクをコピーする",
      openInExternalBrowser: "外部ブラウザーで開く",
      moreActions: "その他の記事操作",
    },
  },
  decorators: [mobileDecorator],
  parameters: denseNarrowViewportParameters,
};

export const MobileA11yDisabledState: Story = {
  args: {
    layoutMode: "mobile",
    showCloseButton: false,
    articleState: {
      ...meta.args.articleState,
      hasArticle: false,
      isRead: true,
      isStarred: false,
      isBrowserOpen: false,
    },
    actionOptions: {
      ...meta.args.actionOptions,
      canToggleRead: false,
      canToggleStar: false,
      canCopyLink: false,
      canOpenInBrowser: false,
      canOpenInExternalBrowser: false,
    },
    labels: {
      ...meta.args.labels,
      toggleReadShort: "既読状態",
      toggleStarShort: "スター",
      previewToggleOffShort: "プレビュー",
    },
  },
  decorators: [mobileDecorator],
  parameters: denseNarrowViewportParameters,
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
