import { ArrowUpRight } from "lucide-react";
import { LabelChip } from "@/components/shared/label-chip";
import { cn } from "@/lib/utils";
import type { SubscriptionSummaryCard } from "./subscriptions-index.types";

function resolveCardClassName(tone: SubscriptionSummaryCard["tone"] = "neutral") {
  if (tone === "danger") {
    return "border-state-danger-border bg-state-danger-surface";
  }

  if (tone === "stale") {
    return "border-state-warning-border bg-state-warning-surface";
  }

  if (tone === "review") {
    return "border-state-review-border bg-state-review-surface";
  }

  return "border-border/70 bg-surface-1/72";
}

export function SubscriptionsOverviewSummary({ cards }: { cards: SubscriptionSummaryCard[] }) {
  return (
    <section
      className="rounded-lg border border-border/55 px-4 py-4 sm:px-6 sm:py-5"
      style={{
        backgroundColor: "var(--subscriptions-summary-surface)",
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[0.96fr_1.12fr_0.96fr_0.96fr] lg:gap-4">
        {cards.map((card) => {
          const numericValue = Number(card.value);
          const hasAction = Boolean(card.actionLabel && card.onAction);
          const isActionable = hasAction && Number.isFinite(numericValue) && numericValue > 0;
          const isPrimary = isActionable && card.tone === "review";
          const className = cn(
            "flex min-h-[116px] flex-col justify-between rounded-lg border px-3.5 py-3.5 text-left transition-[border-color,background-color,color,box-shadow,transform] duration-150 sm:min-h-[132px] sm:px-5 sm:py-5",
            resolveCardClassName(isActionable ? card.tone : "neutral"),
            isPrimary ? "shadow-[var(--subscriptions-summary-card-shadow)]" : "shadow-none",
            !isActionable && card.actionLabel && "text-foreground-soft/80",
            isPrimary && "col-span-2 lg:col-span-1",
          );

          if (isActionable && card.actionLabel && card.onAction) {
            return (
              <button
                key={card.label}
                type="button"
                className={cn(
                  className,
                  "group cursor-pointer",
                  isPrimary
                    ? "hover:-translate-y-0.5 hover:border-border-strong hover:shadow-elevation-1"
                    : "hover:-translate-y-0.5 hover:border-border-strong/90",
                )}
                onClick={card.onAction}
              >
                <div>
                  <span className="block text-[11px] font-medium tracking-[0.14em] text-foreground-soft uppercase">
                    {card.label}
                  </span>
                  <span className="mt-2 block text-[1.85rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[2.1rem]">
                    {card.value}
                  </span>
                  {card.caption ? (
                    <p className="mt-1.5 max-w-[24ch] text-[13px] leading-5 text-foreground-soft sm:mt-2 sm:max-w-[26ch] sm:text-sm sm:leading-[1.55]">
                      {card.caption}
                    </p>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 sm:mt-4">
                  <LabelChip
                    tone="neutral"
                    className={cn(
                      "px-2.5 py-1 text-[10px] text-foreground-soft transition-colors group-hover:text-foreground",
                      isPrimary && "bg-surface-1/88",
                    )}
                  >
                    {card.actionLabel}
                  </LabelChip>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium tracking-[0.08em] text-foreground-soft transition-colors group-hover:text-foreground uppercase">
                    整理へ
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </button>
            );
          }

          return (
            <div key={card.label} className={className}>
              <div>
                <p className="text-[11px] font-medium tracking-[0.14em] text-foreground-soft uppercase">{card.label}</p>
                <p className="mt-2 text-[1.85rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[2.1rem]">
                  {card.value}
                </p>
                {card.caption ? (
                  <p className="mt-1.5 max-w-[24ch] text-[13px] leading-5 text-foreground-soft sm:mt-2 sm:max-w-[26ch] sm:text-sm sm:leading-[1.55]">
                    {card.caption}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
