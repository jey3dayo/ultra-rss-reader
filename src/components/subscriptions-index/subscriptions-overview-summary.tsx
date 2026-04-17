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

export function SubscriptionsOverviewSummary({
  cards,
  onSelectFilter,
  batchActionLabel,
  batchActionDescription,
  onOpenBatchAction,
}: {
  cards: SubscriptionSummaryCard[];
  onSelectFilter: (filterKey: SubscriptionSummaryCard["filterKey"]) => void;
  batchActionLabel?: string;
  batchActionDescription?: string;
  onOpenBatchAction?: (() => void) | null;
}) {
  return (
    <section
      className="rounded-lg border border-border/55 px-4 py-3 sm:px-5 sm:py-4"
      style={{
        backgroundColor: "var(--subscriptions-summary-surface)",
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[0.96fr_1.12fr_0.96fr_0.96fr] lg:gap-3.5">
        {cards.map((card) => {
          const numericValue = Number(card.value);
          const isActionable = Number.isFinite(numericValue);
          const isPrimary = card.tone === "review";
          const className = cn(
            "flex min-h-[96px] flex-col justify-between rounded-lg border px-3.5 py-3 text-left transition-[border-color,background-color,color,box-shadow,transform] duration-150 sm:min-h-[108px] sm:px-4.5 sm:py-4",
            resolveCardClassName(card.tone),
            isPrimary || card.isActive ? "shadow-[var(--subscriptions-summary-card-shadow)]" : "shadow-none",
            isPrimary && "col-span-2 lg:col-span-1",
            card.isActive && "border-border-strong bg-surface-1/92 ring-1 ring-border-strong/65",
          );

          if (isActionable) {
            return (
              <button
                key={card.label}
                type="button"
                className={cn(
                  className,
                  "group cursor-pointer",
                  "hover:-translate-y-0.5 hover:border-border-strong/90",
                )}
                aria-pressed={card.isActive}
                onClick={() => onSelectFilter(card.filterKey)}
              >
                <div>
                  <span className="block text-[11px] font-medium tracking-[0.14em] text-foreground-soft uppercase">
                    {card.label}
                  </span>
                  <span className="mt-1.5 block text-[1.72rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[1.96rem]">
                    {card.value}
                  </span>
                  {card.caption ? (
                    <p className="mt-1 max-w-[24ch] text-[12px] leading-5 text-foreground-soft sm:max-w-[26ch] sm:text-[13px] sm:leading-[1.5]">
                      {card.caption}
                    </p>
                  ) : null}
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <LabelChip
                    tone="neutral"
                    className={cn(
                      "px-2 py-0.75 text-[10px] text-foreground-soft transition-colors group-hover:text-foreground",
                      card.isActive && "border-border-strong bg-surface-1 text-foreground",
                      isPrimary && !card.isActive && "bg-surface-1/88",
                    )}
                  >
                    {card.isActive ? "表示中" : "絞り込む"}
                  </LabelChip>
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
      {batchActionLabel && onOpenBatchAction ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-surface-1/82 px-4 py-2.5">
          <p className="text-sm text-foreground-soft">{batchActionDescription}</p>
          <button
            type="button"
            className="rounded-md border border-border-strong bg-surface-1 px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-2"
            onClick={onOpenBatchAction}
          >
            {batchActionLabel}
          </button>
        </div>
      ) : null}
    </section>
  );
}
