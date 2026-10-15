import { cn } from "cn";
import { ExternalLink, List, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { FeedDetailCard, FeedDetailRow } from "@/components/shared/feed-detail-card";
import { LabelChip } from "@/components/shared/label-chip";
import { Link } from "@/components/shared/link";
import { SurfaceCard } from "@/components/shared/surface-card";
import { Button } from "@/components/ui/button";
import { normalizeFeedWebsiteUrlCandidate } from "@/lib/feed/feed";

type FeedDetailTone = "neutral" | "low" | "medium" | "high";
type FeedDetailAccentTone = "unread" | "starred";

type FeedDetailLink = {
  href: string;
  label: string;
  icon?: LucideIcon;
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
  accentTone?: FeedDetailAccentTone;
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
  showMetricsTopDivider?: boolean;
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

const lowWireAccentClassNames: Record<
  FeedDetailAccentTone,
  {
    panel: string;
    header: string;
    visual: string;
    metrics: string;
    row: string;
  }
> = {
  unread: {
    panel:
      "feed-detail-accent-unread border-[var(--feed-detail-accent-unread-panel-border)] bg-[var(--feed-detail-accent-unread-panel-surface)]",
    header: "bg-[var(--feed-detail-accent-unread-header-surface)]",
    visual:
      "border-[var(--feed-detail-accent-unread-visual-border)] bg-[var(--feed-detail-accent-unread-visual-surface)] text-[var(--feed-detail-accent-unread-visual-foreground)]",
    metrics:
      "border-[var(--feed-detail-accent-unread-metrics-border)] bg-[var(--feed-detail-accent-unread-metrics-surface)]",
    row: "bg-[var(--feed-detail-accent-unread-row-surface)]",
  },
  starred: {
    panel:
      "feed-detail-accent-starred border-[var(--feed-detail-accent-starred-panel-border)] bg-[var(--feed-detail-accent-starred-panel-surface)]",
    header: "bg-[var(--feed-detail-accent-starred-header-surface)]",
    visual:
      "border-[var(--feed-detail-accent-starred-visual-border)] bg-[var(--feed-detail-accent-starred-visual-surface)] text-[var(--feed-detail-accent-starred-visual-foreground)]",
    metrics:
      "border-[var(--feed-detail-accent-starred-metrics-border)] bg-[var(--feed-detail-accent-starred-metrics-surface)]",
    row: "bg-[var(--feed-detail-accent-starred-row-surface)]",
  },
};

type FeedDetailAccentClassNames = (typeof lowWireAccentClassNames)[FeedDetailAccentTone];

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

function FeedDetailHeader({
  title,
  resolvedTitleHref,
  isLowWire,
  lowWireAccent,
  leadingVisual,
  badgeLabel,
  badgeTone,
  summaryText,
  primaryAction,
}: {
  title: string;
  resolvedTitleHref: string | null;
  isLowWire: boolean;
  lowWireAccent: FeedDetailAccentClassNames | null;
  leadingVisual?: ReactNode;
  badgeLabel?: string;
  badgeTone: FeedDetailTone;
  summaryText?: string;
  primaryAction?: FeedDetailPanelProps["primaryAction"];
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden px-4 py-3.5 sm:px-4 sm:py-4",
        isLowWire
          ? "border-b border-[var(--workspace-low-wire-divider)] bg-[var(--workspace-low-wire-header-surface)]"
          : "border-b border-border/50 bg-surface-1/48",
        lowWireAccent?.header,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px",
          isLowWire ? "bg-[var(--workspace-low-wire-highlight)]" : "bg-transparent",
        )}
      />
      <div className={cn("grid items-start gap-3.5", leadingVisual ? "grid-cols-[auto_minmax(0,1fr)]" : "grid-cols-1")}>
        {leadingVisual ? (
          <div
            data-testid="feed-detail-leading-visual"
            className={cn(
              "flex shrink-0 items-center justify-center rounded-md text-foreground shadow-none",
              isLowWire
                ? "size-10 border border-[var(--workspace-low-wire-section-border)] bg-surface-1/88 ring-1 ring-[var(--workspace-low-wire-highlight)]"
                : "size-10 border border-border/65 bg-surface-1/88",
              lowWireAccent?.visual,
            )}
          >
            {leadingVisual}
          </div>
        ) : null}
        <div data-testid="feed-detail-main-column" className="min-w-0">
          <div className={cn("flex min-w-0 items-start justify-between gap-2.5", leadingVisual && "min-h-10")}>
            {resolvedTitleHref ? (
              <Link
                variant="detail"
                href={resolvedTitleHref}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 no-underline"
              >
                <h3 className="min-w-0 font-sans text-[1.12rem] font-semibold leading-snug tracking-[-0.025em] text-foreground">
                  {title}
                </h3>
              </Link>
            ) : (
              <h3 className="min-w-0 flex-1 font-sans text-[1.12rem] font-semibold leading-snug tracking-[-0.025em] text-foreground">
                {title}
              </h3>
            )}
            {badgeLabel ? (
              <LabelChip
                data-testid="feed-detail-status"
                tone={resolveBadgeClassName(badgeTone)}
                className="mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[10px] tracking-[0.08em]"
              >
                {badgeLabel}
              </LabelChip>
            ) : null}
            {primaryAction ? (
              <Button
                aria-label={primaryAction.ariaLabel ?? primaryAction.label}
                variant="ghost"
                size="icon-xs"
                data-testid="feed-detail-primary-action"
                className={cn(
                  "size-8 shrink-0 border-transparent bg-transparent p-0 text-foreground-soft shadow-none hover:bg-transparent hover:text-foreground",
                  isLowWire && "hover:text-foreground",
                )}
                title={primaryAction.label}
                onClick={primaryAction.onClick}
              >
                <List className="size-3.5" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
          {summaryText ? (
            <p
              className={cn(
                "mt-3 max-w-[48rem] font-serif text-[1rem] leading-7 text-foreground-soft",
                isLowWire && "font-sans text-sm leading-6 text-foreground-soft/95",
              )}
            >
              {summaryText}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FeedDetailReasonSection({
  reasonBox,
  reasonChips,
  isLowWire,
}: {
  reasonBox: FeedDetailPanelProps["reasonBox"];
  reasonChips: string[];
  isLowWire: boolean;
}) {
  return (
    <div data-testid="feed-detail-secondary-column" className="space-y-3.5">
      {reasonBox ? (
        <SurfaceCard
          data-testid="feed-detail-reason-box"
          variant="info"
          tone={resolveReasonBoxClassName(reasonBox.tone)}
          padding="compact"
          className={cn(
            "rounded-md px-3.5 py-3 shadow-none",
            isLowWire && reasonBox.tone !== "high" && reasonBox.tone !== "medium" && "border-transparent",
            reasonBox.tone === "medium" &&
              "border-state-warning-border/80 bg-state-warning-surface/80 text-state-warning-foreground",
          )}
        >
          <p className="font-sans text-[11px] font-medium tracking-[0.08em] text-current uppercase">
            {reasonBox.title}
          </p>
          <p className="mt-1.5 font-sans text-sm leading-6 text-current">{reasonBox.body}</p>
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
  );
}

function FeedDetailMetrics({
  metrics,
  isLowWire,
  lowWireAccent,
  showMetricsTopDivider,
}: {
  metrics: FeedDetailPanelProps["metrics"];
  isLowWire: boolean;
  lowWireAccent: FeedDetailAccentClassNames | null;
  showMetricsTopDivider: boolean;
}) {
  return (
    <dl
      className={cn(
        "grid overflow-hidden text-sm",
        isLowWire
          ? "gap-px rounded-md border border-[var(--workspace-low-wire-divider)] bg-[var(--workspace-low-wire-divider)] sm:grid-cols-2 [&>*:last-child:nth-child(odd)]:sm:col-span-2"
          : cn("gap-2.5 sm:grid-cols-2", showMetricsTopDivider ? "border-t border-border/55 pt-3" : "pt-1"),
        lowWireAccent?.metrics,
      )}
    >
      {metrics.map((metric) => (
        <FeedDetailRow
          key={String(metric.label)}
          label={metric.label}
          value={metric.value}
          surface={isLowWire ? "low-wire" : "card"}
          className={lowWireAccent?.row}
        />
      ))}
    </dl>
  );
}

function FeedDetailLinks({ links }: { links: FeedDetailLink[] }) {
  if (links.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2 text-sm">
      {links.map((link) => {
        const LinkIcon = link.icon ?? ExternalLink;
        return (
          <Link key={link.href} variant="detail" href={link.href} target="_blank" rel="noreferrer">
            <LinkIcon aria-hidden="true" className="size-4 shrink-0" />
            <span className="underline decoration-border underline-offset-4">{link.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

function FeedDetailRecentArticles({
  recentArticles,
  recentArticlesHeading,
  isLowWire,
}: {
  recentArticles: FeedDetailArticle[];
  recentArticlesHeading: string;
  isLowWire: boolean;
}) {
  if (recentArticles.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="feed-detail-recent-articles"
      className={cn("space-y-2", isLowWire ? "pt-1" : "border-t border-border/55 pt-3")}
    >
      <h4 className="font-sans text-sm font-medium text-foreground">{recentArticlesHeading}</h4>
      <div className="space-y-1.5">
        {recentArticles.map((article) => (
          <SurfaceCard
            key={article.id}
            variant="info"
            tone="subtle"
            padding="compact"
            className={cn(
              "px-3 py-2 shadow-none",
              isLowWire && "rounded-md border-transparent bg-[var(--workspace-low-wire-group-surface)] px-3 py-2.5",
            )}
          >
            <div className={cn("min-w-0", isLowWire ? "space-y-1" : "flex items-center justify-between gap-3")}>
              {article.url ? (
                <Link
                  variant="detail"
                  href={article.url}
                  target="_blank"
                  rel="noreferrer"
                  className={cn("min-w-0 items-start gap-1.5 no-underline", isLowWire && "flex w-full")}
                >
                  <span className="line-clamp-2 min-w-0 font-serif text-[0.88rem] font-normal leading-5 text-foreground">
                    {article.title}
                  </span>
                  <ExternalLink aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                </Link>
              ) : (
                <span className="line-clamp-2 font-serif text-[0.88rem] font-normal leading-5 text-foreground">
                  {article.title}
                </span>
              )}
              <span className={cn("text-xs text-foreground-soft", !isLowWire && "shrink-0")}>
                {article.publishedAt}
              </span>
            </div>
          </SurfaceCard>
        ))}
      </div>
    </div>
  );
}

function FeedDetailActionBar({
  secondaryAction,
  isLowWire,
}: {
  secondaryAction: NonNullable<FeedDetailPanelProps["secondaryAction"]>;
  isLowWire: boolean;
}) {
  return (
    <div
      data-testid="feed-detail-action-bar"
      className={cn(
        "flex flex-wrap items-center justify-end gap-2 pt-3",
        isLowWire ? "bg-[var(--workspace-low-wire-action-surface)]" : "border-t border-border/55",
      )}
    >
      <Button variant="ghost" size="sm" className="min-h-11 px-4" onClick={secondaryAction.onClick}>
        {secondaryAction.label}
      </Button>
    </div>
  );
}

export function FeedDetailPanel({
  title,
  className,
  surface = "card",
  accentTone,
  titleHref = null,
  badgeLabel,
  badgeTone = "neutral",
  leadingVisual,
  summaryText,
  reasonBox = null,
  reasonChips = EMPTY_REASON_CHIPS,
  showMetricsTopDivider = true,
  metrics,
  links = EMPTY_LINKS,
  recentArticlesHeading,
  recentArticles,
  primaryAction,
  secondaryAction,
}: FeedDetailPanelProps) {
  const resolvedTitleHref = titleHref ? normalizeFeedWebsiteUrlCandidate(titleHref) : null;
  const isLowWire = surface === "low-wire";
  const lowWireAccent = isLowWire && accentTone ? lowWireAccentClassNames[accentTone] : null;

  return (
    <FeedDetailCard
      data-feed-detail-panel=""
      data-feed-detail-accent={lowWireAccent ? accentTone : undefined}
      className={cn(
        "overflow-hidden px-0 py-0 shadow-none sm:px-0 sm:py-0",
        isLowWire ? "border-transparent bg-[var(--workspace-low-wire-group-surface)]" : "border-border/65 bg-card/38",
        lowWireAccent?.panel,
        className,
      )}
    >
      <FeedDetailHeader
        title={title}
        resolvedTitleHref={resolvedTitleHref}
        isLowWire={isLowWire}
        lowWireAccent={lowWireAccent}
        leadingVisual={leadingVisual}
        badgeLabel={badgeLabel}
        badgeTone={badgeTone}
        summaryText={summaryText}
        primaryAction={primaryAction}
      />

      <div className={cn("space-y-4 py-4", isLowWire ? "px-4 sm:px-4" : "px-4 sm:px-5")}>
        <FeedDetailReasonSection reasonBox={reasonBox} reasonChips={reasonChips} isLowWire={isLowWire} />

        <div className="grid gap-3">
          <FeedDetailMetrics
            metrics={metrics}
            isLowWire={isLowWire}
            lowWireAccent={lowWireAccent}
            showMetricsTopDivider={showMetricsTopDivider}
          />

          <FeedDetailLinks links={links} />

          <FeedDetailRecentArticles
            recentArticles={recentArticles}
            recentArticlesHeading={recentArticlesHeading}
            isLowWire={isLowWire}
          />
        </div>

        {secondaryAction ? <FeedDetailActionBar secondaryAction={secondaryAction} isLowWire={isLowWire} /> : null}
      </div>
    </FeedDetailCard>
  );
}
