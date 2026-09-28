import { useTranslation } from "react-i18next";
import { ArticleListSkeleton } from "@/components/reader/article-list-skeleton";
import { SidebarFeedTreeSkeletonRows } from "@/components/reader/sidebar-feed-tree-skeleton";
import { Skeleton } from "@/design-system";

export type AppLayoutLazyPaneKind = "sidebar" | "list" | "content" | "account";

const ACCOUNT_PANE_ROW_META_WIDTH_CLASS_NAMES = ["w-24", "w-20", "w-28"] as const;
const ARTICLE_VIEW_BODY_LINE_WIDTH_CLASS_NAMES = ["w-full", "w-11/12", "w-10/12", "w-full", "w-9/12"] as const;

function AccountPaneShellSkeleton({ label, headingLabel }: { label: string; headingLabel: string }) {
  return (
    <div
      data-testid="app-layout-account-pane-shell-skeleton"
      role="status"
      aria-live="polite"
      className="flex h-full min-h-0 min-w-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground"
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="px-4 pt-4 pb-3">
        <p className="text-[0.68rem] font-medium tracking-[0.12em] text-sidebar-foreground/54 uppercase">
          {headingLabel}
        </p>
      </div>
      <div aria-hidden="true" className="min-h-0 flex-1 space-y-1 overflow-hidden px-2 pb-3">
        {ACCOUNT_PANE_ROW_META_WIDTH_CLASS_NAMES.map((metaWidthClassName) => (
          <div key={metaWidthClassName} className="rounded-md px-3 py-2.5">
            <Skeleton aria-hidden="true" className={`h-3.5 bg-surface-4/70 ${metaWidthClassName}`} />
            <Skeleton aria-hidden="true" className="mt-2 h-3 w-16 bg-surface-4/55" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ArticleViewShellSkeleton({ label }: { label: string }) {
  return (
    <div
      data-testid="app-layout-article-view-shell-skeleton"
      role="status"
      aria-live="polite"
      className="flex h-full min-h-0 min-w-0 flex-col bg-background text-foreground"
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-2 border-b border-border px-6 py-4">
        <Skeleton className="h-5 max-w-md bg-surface-4/70" />
        <Skeleton className="h-3 max-w-xs bg-surface-4/55" />
      </div>
      <div aria-hidden="true" className="min-h-0 flex-1 space-y-3 overflow-hidden px-6 py-5">
        {ARTICLE_VIEW_BODY_LINE_WIDTH_CLASS_NAMES.map((widthClassName) => (
          <Skeleton key={widthClassName} className={`h-3 bg-surface-4/55 ${widthClassName}`} />
        ))}
      </div>
    </div>
  );
}

function SidebarShellSkeleton({ label }: { label: string }) {
  return (
    <div
      data-testid="app-layout-sidebar-shell-skeleton"
      role="status"
      aria-live="polite"
      className="flex h-full min-h-0 min-w-0 flex-col bg-sidebar text-sidebar-foreground"
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="flex items-center gap-2 border-b border-border px-3 py-3">
        <Skeleton className="h-8 min-w-0 flex-1 rounded-md bg-surface-4/55" />
        <Skeleton className="size-8 shrink-0 rounded-md bg-surface-4/70" />
        <Skeleton className="size-8 shrink-0 rounded-md bg-surface-4/70" />
      </div>
      <div aria-hidden="true" className="min-h-0 flex-1 overflow-hidden p-2">
        <SidebarFeedTreeSkeletonRows />
      </div>
    </div>
  );
}

export function AppLayoutLazyPaneFallback({ pane }: { pane: AppLayoutLazyPaneKind }) {
  const { t: commonT } = useTranslation("common");
  const { t: sidebarT } = useTranslation("sidebar");
  const loadingLabel = commonT("loading");

  switch (pane) {
    case "sidebar":
      return <SidebarShellSkeleton label={loadingLabel} />;
    case "list":
      return (
        <div className="h-full min-h-0 min-w-0 overflow-hidden bg-background">
          <ArticleListSkeleton label={loadingLabel} />
        </div>
      );
    case "content":
      return <ArticleViewShellSkeleton label={loadingLabel} />;
    case "account":
      return <AccountPaneShellSkeleton label={loadingLabel} headingLabel={sidebarT("accounts")} />;
  }
}
