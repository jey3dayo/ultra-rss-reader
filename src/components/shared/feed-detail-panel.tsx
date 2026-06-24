import { ExternalLink, List } from "lucide-react";
import type { ReactNode } from "react";
import { workspaceCompactActionButtonClassName } from "@/components/shared/decision-button";
import { FeedDetailCard, FeedDetailRow } from "@/components/shared/feed-detail-card";
import { LabelChip } from "@/components/shared/label-chip";
import { SurfaceCard } from "@/components/shared/surface-card";
import { Button } from "@/components/ui/button";
import { normalizeFeedWebsiteUrlCandidate } from "@/lib/feed/feed";
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
  className?: string;
  surface?: "card" | "low-wire";
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
  "inline-flex items-center gap-1 cursor-pointer text-foreground-soft underline decoration-border underline-offset-4 transition-colors duration-150 ease-standard hover:text-foreground motion-reduce:transition-none";

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
  className,
  surface = "card",
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
  const resolvedTitleHref = titleHref ? normalizeFeedWebsiteUrlCandidate(titleHref) : null;
  const isLowWire = surface === "low-wire";

  return (
    <FeedDetailCard
      data-feed-detail-panel=""
      className={cn(
        "overflow-hidden p-0 shadow-none",
        isLowWire ? "border-transparent bg-[var(--workspace-low-wire-group-surface)]" : "border-border/65 bg-card/38",
        className,
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden px-4 py-4 sm:px-5 sm:py-5",
          isLowWire
            ? "border-b border-[var(--workspace-low-wire-divider)] bg-[var(--workspace-low-wire-header-surface)]"
            : "border-b border-border/50 bg-surface-1/48",
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-px",
            isLowWire ? "bg-[var(--workspace-low-wire-highlight)]" : "bg-transparent",
          )}
        />
        <div
          className={cn("grid items-start gap-3.5", leadingVisual ? "grid-cols-[auto_minmax(0,1fr)]" : "grid-cols-1")}
        >
          {leadingVisual ? (
            <div
              data-testid="feed-detail-leading-visual"
              className={cn(
                "flex shrink-0 items-center justify-center rounded-md text-foreground shadow-none",
                isLowWire
                  ? "size-12 border border-[var(--workspace-low-wire-section-border)] bg-surface-1/88 ring-1 ring-[var(--workspace-low-wire-highlight)]"
                  : "size-10 border border-border/65 bg-surface-1/88",
              )}
            >
              {leadingVisual}
            </div>
          ) : null}
          <div data-testid="feed-detail-main-column" className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-2.5">
              {resolvedTitleHref ? (
                <a
                  href={resolvedTitleHref}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(detailLinkClassName, "inline-flex min-w-0 max-w-full items-start gap-2 no-underline")}
                >
                  <h3 className="font-sans text-[1.28rem] font-medium leading-tight tracking-[-0.03em] text-foreground">
                    {title}
                  </h3>
                  <ExternalLink aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                </a>
              ) : (
                <h3 className="font-sans text-[1.28rem] font-medium leading-tight tracking-[-0.03em] text-foreground">
                  {title}
                </h3>
              )}
              {badgeLabel ? (
                <LabelChip
                  data-testid="feed-detail-status"
                  tone={resolveBadgeClassName(badgeTone)}
                  className="mt-0.5 self-start rounded-md px-2 py-0.5 text-[10px] tracking-[0.08em]"
                >
                  {badgeLabel}
                </LabelChip>
              ) : null}
            </div>
            {summaryText ? (
              <p
                className={cn(
                  "mt-3 max-w-[48rem] font-serif text-[1rem] leading-7 text-foreground-soft",
                  isLowWire && "text-foreground-soft/95",
                )}
              >
                {summaryText}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className={cn("space-y-4 px-4 py-4 sm:px-5", isLowWire && "pt-4")}>
        <div data-testid="feed-detail-secondary-column" className="space-y-3">
          {reasonBox ? (
            <SurfaceCard
              data-testid="feed-detail-reason-box"
              variant="info"
              tone={resolveReasonBoxClassName(reasonBox.tone)}
              padding="compact"
              className={cn(
                "shadow-none",
                isLowWire && "border-[var(--workspace-low-wire-section-border)]",
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
                <LabelChip key={chip} tone="neutral" size="compact" className="rounded-md px-2 py-1">
                  {chip}
                </LabelChip>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3">
          <dl
            className={cn(
              "grid text-sm",
              isLowWire
                ? "overflow-hidden rounded-md border border-[var(--workspace-low-wire-section-border)] bg-surface-1/48 sm:grid-cols-2 [&>*:last-child:nth-child(odd)]:sm:col-span-2 [&>*:nth-last-child(-n+2)]:sm:border-b-0 [&>*:nth-child(odd):not(:last-child)]:sm:border-r [&>*:nth-child(odd):not(:last-child)]:sm:border-[var(--workspace-low-wire-divider)]"
                : "gap-2.5 border-t border-border/55 pt-3 sm:grid-cols-2",
            )}
          >
            {metrics.map((metric) => (
              <FeedDetailRow
                key={String(metric.label)}
                label={metric.label}
                value={metric.value}
                surface={isLowWire ? "low-wire" : "card"}
              />
            ))}
          </dl>

          {links.length > 0 ? (
            <div className="grid gap-2 text-sm">
              {links.map((link) => (
                <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className={detailLinkClassName}>
                  <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
                  <span className="underline decoration-border underline-offset-4">{link.label}</span>
                </a>
              ))}
            </div>
          ) : null}

          {recentArticles.length > 0 ? (
            <div
              data-testid="feed-detail-recent-articles"
              className={cn(
                "space-y-2 pt-3",
                isLowWire ? "border-t border-[var(--workspace-low-wire-divider)]" : "border-t border-border/55",
              )}
            >
              <h4 className="font-sans text-sm font-medium text-foreground">{recentArticlesHeading}</h4>
              <div className="space-y-1">
                {recentArticles.map((article) => (
                  <SurfaceCard
                    key={article.id}
                    variant="info"
                    tone="subtle"
                    padding="compact"
                    className={cn("px-3 py-2 shadow-none", isLowWire && "border-transparent bg-surface-1/36")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      {article.url ? (
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(detailLinkClassName, "min-w-0 items-start gap-1.5 no-underline")}
                        >
                          <span className="line-clamp-2 min-w-0 font-serif text-[0.88rem] font-normal leading-5 text-foreground">
                            {article.title}
                          </span>
                          <ExternalLink aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                        </a>
                      ) : (
                        <span className="line-clamp-2 font-serif text-[0.88rem] font-normal leading-5 text-foreground">
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
          <div
            data-testid="feed-detail-action-bar"
            className={cn(
              "flex flex-wrap items-center justify-end gap-2 border-t pt-3",
              isLowWire
                ? "border-[var(--workspace-low-wire-divider)] bg-[var(--workspace-low-wire-action-surface)]"
                : "border-border/55",
            )}
          >
            {primaryAction ? (
              <Button
                aria-label={primaryAction.ariaLabel ?? primaryAction.label}
                variant="outline"
                size="sm"
                className={cn(
                  workspaceCompactActionButtonClassName,
                  "min-h-9 w-auto border-border/70 bg-surface-1/72 px-3 text-[12px] text-foreground-soft shadow-none hover:bg-surface-2 hover:text-foreground",
                )}
                onClick={primaryAction.onClick}
              >
                <List className="size-4" />
                {primaryAction.label}
              </Button>
            ) : null}
            {secondaryAction ? (
              <Button variant="ghost" size="sm" className="min-h-11 px-4" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </FeedDetailCard>
  );
}
