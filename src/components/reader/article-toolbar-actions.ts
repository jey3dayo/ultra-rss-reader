export type ArticleToolbarLayoutMode = "wide" | "compact" | "mobile";

export type ArticleToolbarActionResolverInput = {
  hasArticle: boolean;
  hasUrl: boolean;
  showCopyLinkPreference: boolean;
  hideBrowserOverlayActions: boolean;
  layoutMode: ArticleToolbarLayoutMode;
};

export type ArticleToolbarActionResolverResult = {
  canToggleRead: boolean;
  canToggleStar: boolean;
  showCopyLinkButton: boolean;
  canCopyLink: boolean;
  showOpenInBrowserButton: boolean;
  canOpenInBrowser: boolean;
  showOpenInExternalBrowserButton: boolean;
  canOpenInExternalBrowser: boolean;
  showExternalBrowserInMoreMenu: boolean;
};

export type ArticleToolbarActionOptions = Omit<ArticleToolbarActionResolverResult, "showExternalBrowserInMoreMenu"> & {
  showExternalBrowserInMoreMenu?: ArticleToolbarActionResolverResult["showExternalBrowserInMoreMenu"];
};

export type ArticleToolbarArticleState = {
  hasArticle: boolean;
  isRead: boolean;
  isStarred: boolean;
  isBrowserOpen: boolean;
  hideBrowserOverlayActions?: boolean;
};

type ArticleToolbarActionResolverContract = {
  actionId: string;
  resultKeys: readonly (keyof ArticleToolbarActionResolverResult)[];
  actionOptionKeys: readonly (keyof ArticleToolbarActionOptions)[];
};

export const ARTICLE_TOOLBAR_ACTION_RESOLVER_CONTRACT = [
  {
    actionId: "toggle-read",
    resultKeys: ["canToggleRead"],
    actionOptionKeys: ["canToggleRead"],
  },
  {
    actionId: "toggle-star",
    resultKeys: ["canToggleStar"],
    actionOptionKeys: ["canToggleStar"],
  },
  {
    actionId: "open-in-browser",
    resultKeys: ["showOpenInBrowserButton", "canOpenInBrowser"],
    actionOptionKeys: ["showOpenInBrowserButton", "canOpenInBrowser"],
  },
  {
    actionId: "open-in-external-browser",
    resultKeys: ["showOpenInExternalBrowserButton", "canOpenInExternalBrowser", "showExternalBrowserInMoreMenu"],
    actionOptionKeys: ["showOpenInExternalBrowserButton", "canOpenInExternalBrowser", "showExternalBrowserInMoreMenu"],
  },
  {
    actionId: "copy-link",
    resultKeys: ["showCopyLinkButton", "canCopyLink"],
    actionOptionKeys: ["showCopyLinkButton", "canCopyLink"],
  },
] as const satisfies readonly ArticleToolbarActionResolverContract[];

export function resolveArticleToolbarActions({
  hasArticle,
  hasUrl,
  showCopyLinkPreference,
  hideBrowserOverlayActions,
  layoutMode,
}: ArticleToolbarActionResolverInput): ArticleToolbarActionResolverResult {
  const canUseUrl = hasArticle && hasUrl;
  const showBrowserOverlayAction = !hideBrowserOverlayActions;

  return {
    canToggleRead: hasArticle,
    canToggleStar: hasArticle,
    showCopyLinkButton: showCopyLinkPreference,
    canCopyLink: canUseUrl,
    showOpenInBrowserButton: showBrowserOverlayAction,
    canOpenInBrowser: canUseUrl,
    showOpenInExternalBrowserButton: showBrowserOverlayAction,
    canOpenInExternalBrowser: canUseUrl,
    showExternalBrowserInMoreMenu: layoutMode === "mobile" && showBrowserOverlayAction && canUseUrl,
  };
}
