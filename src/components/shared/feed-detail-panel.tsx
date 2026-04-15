import { ExternalLink, List } from "lucide-react";
import type { ReactNode } from "react";
import { FeedCleanupCard, FeedCleanupDetailRow } from "@/components/feed-cleanup/feed-cleanup-card";
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

type FeedDetailPanelProps = {
  title: string;
  titleHref?: string | null;
  badgeLabel?: string;
  badgeTone?: FeedDetailTone;
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
  "inline-flex items-center gap-1 cursor-pointer text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground";

function resolveBadgeClassName(tone: FeedDetailTone) {
  if (tone === "high") {
    return "border-rose-500/25 bg-rose-500/10 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/12 dark:text-rose-100";
  }

  if (tone === "medium") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/12 dark:text-amber-100";
  }

  if (tone === "low") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/12 dark:text-emerald-100";
  }

  return "border-border/70 bg-background/80 text-muted-foreground";
}

function resolveReasonBoxClassName(tone: FeedDetailTone) {
  if (tone === "high") {
    return "border-rose-500/25 bg-rose-500/10 text-rose-950 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100";
  }

  if (tone === "medium") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100";
  }

  if (tone === "low") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100";
  }

  return "border-border/70 bg-card/70 text-foreground";
}

export function FeedDetailPanel({
  title,
  titleHref = null,
  badgeLabel,
  badgeTone = "neutral",
  summaryText,
  reasonBox = null,
  reasonChips = [],
  metrics,
  links = [],
  recentArticlesHeading,
  recentArticles,
  primaryAction,
  secondaryAction,
}: FeedDetailPanelProps) {
  return (
    <FeedCleanupCard className="rounded-3xl border-border/70 bg-[linear-gradient(180deg,hsl(var(--card)/0.9),hsl(var(--background)/0.97))]">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {titleHref ? (
              <a
                href={titleHref}
                target="_blank"
                rel="noreferrer"
                className={cn(detailLinkClassName, "inline-flex items-center gap-2 no-underline")}
              >
                <h3 className="font-sans text-[1.75rem] font-normal tracking-[-0.03em] text-foreground">{title}</h3>
                <ExternalLink aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
              </a>
            ) : (
              <h3 className="font-sans text-[1.75rem] font-normal tracking-[-0.03em] text-foreground">{title}</h3>
            )}
            {summaryText ? (
              <div className="mt-4 rounded-[20px] border border-border/55 bg-[linear-gradient(180deg,hsl(var(--background)/0.92),hsl(var(--card)/0.78))] px-5 py-3.5 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.035),0_10px_30px_-26px_hsl(var(--foreground)/0.35)]">
                <p className="font-serif text-[0.98rem] leading-7 text-muted-foreground/95">{summaryText}</p>
              </div>
            ) : null}
          </div>
          {badgeLabel ? (
            <span className={cn("rounded-full border px-3 py-1 text-xs font-medium", resolveBadgeClassName(badgeTone))}>
              {badgeLabel}
            </span>
          ) : null}
        </div>

        {reasonBox ? (
          <div className={cn("rounded-2xl border px-4 py-4", resolveReasonBoxClassName(reasonBox.tone))}>
            <p className="font-sans text-sm font-medium text-current">{reasonBox.title}</p>
            <p className="mt-1 font-serif text-sm leading-6 text-current/85">{reasonBox.body}</p>
          </div>
        ) : null}

        {reasonChips.length > 0 && !reasonBox ? (
          <div className="flex flex-wrap gap-2">
            {reasonChips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-border/65 bg-background/75 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {chip}
              </span>
            ))}
          </div>
        ) : null}

        <div className="grid gap-5">
          <dl className="grid gap-3 text-sm">
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
            <div className="space-y-3.5 pt-4">
              <h4 className="font-sans text-sm font-medium text-foreground">{recentArticlesHeading}</h4>
              <div className="space-y-1.5">
                {recentArticles.map((article) => (
                  <div key={article.id} className="rounded-2xl bg-card/80 px-4 py-2.5">
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
                      <span className="shrink-0 text-xs text-muted-foreground">{article.publishedAt}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {primaryAction || secondaryAction ? (
          <div className="flex flex-wrap gap-3">
            {primaryAction ? (
              <Button
                aria-label={primaryAction.ariaLabel ?? primaryAction.label}
                variant="outline"
                className="w-full justify-center rounded-lg border-border/70 bg-background/70 px-4 py-2.5 text-sm font-medium shadow-none hover:bg-card/80"
                onClick={primaryAction.onClick}
              >
                <List className="h-4 w-4" />
                {primaryAction.label}
              </Button>
            ) : null}
            {secondaryAction ? (
              <Button variant="ghost" className="rounded-2xl px-4" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </FeedCleanupCard>
  );
}
