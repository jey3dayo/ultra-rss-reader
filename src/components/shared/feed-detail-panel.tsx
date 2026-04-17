import { ExternalLink, List } from "lucide-react";
import type { ReactNode } from "react";
import { FeedCleanupCard, FeedCleanupDetailRow } from "@/components/feed-cleanup/feed-cleanup-card";
import { workspaceCompactActionButtonClassName } from "@/components/shared/decision-button";
import { LabelChip } from "@/components/shared/label-chip";
import { SurfaceCard } from "@/components/shared/surface-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FeedDetailTone = "neutral" | "low" | "medium" | "high";

type FeedDetailLink = {
  href: string;
  label: string;
};

type FeedDetailArticle = {
  id: string;
  title: string;
  publishedAt: string;
  url: string | null;
};

const EMPTY_REASON_CHIPS: string[] = [];
const EMPTY_LINKS: FeedDetailLink[] = [];

type FeedDetailPanelProps = {
  title: string;
  titleHref?: string | null;
  badgeLabel?: string;
  badgeTone?: FeedDetailTone;
  leadingVisual?: ReactNode;
  summaryText?: string;
  reasonBox?: {
    title: string;
    body: string;
    tone: FeedDetailTone;
  } | null;
  reasonChips?: string[];
  metrics: Array<{
    label: string;
    value: ReactNode;
  }>;
  links?: FeedDetailLink[];
  recentArticlesHeading: string;
  recentArticles: FeedDetailArticle[];
  primaryAction?: {
    label: string;
    onClick: () => void;
    ariaLabel?: string;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
};

const detailLinkClassName =
  "inline-flex items-center gap-1 cursor-pointer text-foreground-soft underline decoration-border underline-offset-4 transition-colors hover:text-foreground";

function resolveBadgeClassName(tone: FeedDetailTone) {
  if (tone === "high") {
    return "danger";
  }

  if (tone === "medium") {
    return "warning";
  }

  if (tone === "low") {
    return "success";
  }

  return "neutral";
}

function resolveReasonBoxClassName(tone: FeedDetailTone) {
  if (tone === "high") {
    return "danger";
  }

  if (tone === "medium") {
    return "default";
  }

  if (tone === "low") {
    return "success";
  }

  return "subtle";
}

export function FeedDetailPanel({
  title,
  titleHref = null,
  badgeLabel,
  badgeTone = "neutral",
  leadingVisual,
  summaryText,
  reasonBox = null,
  reasonChips = EMPTY_REASON_CHIPS,
  metrics,
  links = EMPTY_LINKS,
  recentArticlesHeading,
  recentArticles,
  primaryAction,
  secondaryAction,
}: FeedDetailPanelProps) {
  return (
    <FeedCleanupCard className="border-border/65 bg-card/38 shadow-none">
      <div className="space-y-4.5">
        <div className={cn("grid items-start gap-3", leadingVisual ? "grid-cols-[auto_minmax(0,1fr)]" : "grid-cols-1")}>
          {leadingVisual ? (
            <div
              data-testid="feed-detail-leading-visual"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/65 bg-surface-1/88 text-foreground shadow-none"
            >
              {leadingVisual}
            </div>
          ) : null}
          <div data-testid="feed-detail-main-column" className="min-w-0">
            <div className="min-w-0">
              {titleHref ? (
                <a
                  href={titleHref}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(detailLinkClassName, "inline-flex max-w-full items-start gap-2 no-underline")}
                >
                  <h3 className="font-sans text-[1.6rem] font-normal tracking-[-0.03em] text-foreground">{title}</h3>
                  <ExternalLink aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
                </a>
              ) : (
                <h3 className="font-sans text-[1.6rem] font-normal tracking-[-0.03em] text-foreground">{title}</h3>
              )}
            </div>
          </div>
        </div>

        <div data-testid="feed-detail-secondary-column" className="space-y-3">
          {badgeLabel ? (
            <LabelChip
              data-testid="feed-detail-status"
              tone={resolveBadgeClassName(badgeTone)}
              className="self-start rounded-lg px-2.5 py-1 text-[10px] tracking-[0.02em]"
            >
              {badgeLabel}
            </LabelChip>
          ) : null}

          {summaryText ? (
            <SurfaceCard variant="info" tone="subtle" padding="compact" className="bg-surface-1/76 shadow-none">
              <p className="font-serif text-[0.98rem] leading-7 text-foreground-soft">{summaryText}</p>
            </SurfaceCard>
          ) : null}

          {reasonBox ? (
            <SurfaceCard
              data-testid="feed-detail-reason-box"
              variant="info"
              tone={resolveReasonBoxClassName(reasonBox.tone)}
              padding="compact"
              className={cn(
                "shadow-none",
                reasonBox.tone === "medium" &&
                  "border-state-warning-border/80 bg-state-warning-surface/80 text-state-warning-foreground",
              )}
            >
              <p className="font-sans text-[11px] font-medium tracking-[0.08em] text-current uppercase">
                {reasonBox.title}
              </p>
              <p className="mt-1.5 font-serif text-sm leading-6 text-current">{reasonBox.body}</p>
            </SurfaceCard>
          ) : null}

          {reasonChips.length > 0 && !reasonBox ? (
            <div className="flex flex-wrap gap-2">
              {reasonChips.map((chip) => (
                <LabelChip key={chip} tone="neutral" size="compact" className="rounded-lg px-2 py-1">
                  {chip}
                </LabelChip>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4">
          <dl className="grid gap-3.5 border-t border-border/55 pt-3.5 text-sm">
            {metrics.map((metric) => (
              <FeedCleanupDetailRow key={String(metric.label)} label={metric.label} value={metric.value} />
            ))}
          </dl>

          {links.length > 0 ? (
            <div className="grid gap-2 text-sm">
              {links.map((link) => (
                <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className={detailLinkClassName}>
                  <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span className="underline decoration-border underline-offset-4">{link.href}</span>
                </a>
              ))}
            </div>
          ) : null}

          {recentArticles.length > 0 ? (
            <div className="space-y-3 border-t border-border/55 pt-4">
              <h4 className="font-sans text-sm font-medium text-foreground">{recentArticlesHeading}</h4>
              <div className="space-y-1.5">
                {recentArticles.map((article) => (
                  <SurfaceCard key={article.id} variant="info" tone="subtle" padding="compact" className="shadow-none">
                    <div className="flex items-center justify-between gap-3">
                      {article.url ? (
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(detailLinkClassName, "line-clamp-2 no-underline")}
                        >
                          <span className="font-serif text-[0.95rem] font-normal leading-6 text-foreground">
                            {article.title}
                          </span>
                          <ExternalLink aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        </a>
                      ) : (
                        <span className="line-clamp-2 font-serif text-[0.95rem] font-normal leading-6 text-foreground">
                          {article.title}
                        </span>
                      )}
                      <span className="shrink-0 text-xs text-foreground-soft">{article.publishedAt}</span>
                    </div>
                  </SurfaceCard>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {primaryAction || secondaryAction ? (
          <div className="flex flex-wrap gap-3 border-t border-border/55 pt-4">
            {primaryAction ? (
              <Button
                aria-label={primaryAction.ariaLabel ?? primaryAction.label}
                variant="outline"
                size="lg"
                className={cn(
                  workspaceCompactActionButtonClassName,
                  "w-full border-border-strong bg-surface-1/88 text-foreground-soft shadow-none hover:bg-surface-2 hover:text-foreground",
                )}
                onClick={primaryAction.onClick}
              >
                <List className="h-4 w-4" />
                {primaryAction.label}
              </Button>
            ) : null}
            {secondaryAction ? (
              <Button variant="ghost" size="sm" className="px-4" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </FeedCleanupCard>
  );
}
