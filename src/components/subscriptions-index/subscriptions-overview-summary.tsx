import { LabelChip } from "@/components/shared/label-chip";
import { cn } from "@/lib/utils";
import type { SubscriptionSummaryCard } from "./subscriptions-index.types";

function resolveCardClassName(tone: SubscriptionSummaryCard["tone"] = "neutral") {
  if (tone === "danger") {
    return "border-state-danger-border/75 bg-state-danger-surface/84";
  }

  if (tone === "stale") {
    return "border-state-warning-border/75 bg-state-warning-surface/84";
  }

  if (tone === "review") {
    return "border-state-review-border/80 bg-state-review-surface/86";
  }

  return "border-border/60 bg-surface-1/62";
}

function resolveActiveCardClassName(tone: SubscriptionSummaryCard["tone"] = "neutral") {
  if (tone === "danger") {
    return "border-state-danger-border/90 bg-state-danger-surface shadow-[0_0_0_1px_rgba(207,45,86,0.34),0_18px_38px_-24px_rgba(0,0,0,0.42)] ring-1 ring-state-danger-border/50";
  }

  if (tone === "stale") {
    return "border-state-warning-border/90 bg-state-warning-surface shadow-[0_0_0_1px_rgba(192,133,50,0.28),0_18px_38px_-24px_rgba(0,0,0,0.38)] ring-1 ring-state-warning-border/45";
  }

  if (tone === "review") {
    return "border-state-review-border/95 bg-state-review-surface shadow-[0_0_0_1px_rgba(245,78,0,0.26),0_20px_42px_-24px_rgba(0,0,0,0.42)] ring-1 ring-state-review-border/45";
  }

  return "border-border-strong bg-surface-1 shadow-[0_0_0_1px_rgba(38,37,30,0.18),0_18px_38px_-24px_rgba(0,0,0,0.34)] ring-1 ring-border-strong/60";
}

function resolveActiveAccentClassName(tone: SubscriptionSummaryCard["tone"] = "neutral") {
  if (tone === "danger") {
    return "bg-state-danger-border";
  }

  if (tone === "stale") {
    return "bg-state-warning-border";
  }

  if (tone === "review") {
    return "bg-state-review-border";
  }

  return "bg-secondary";
}

function resolveActiveBadgeClassName(tone: SubscriptionSummaryCard["tone"] = "neutral") {
  if (tone === "danger") {
    return "border-state-danger-border/75 bg-state-danger-surface/92 text-state-danger-foreground";
  }

  if (tone === "stale") {
    return "border-state-warning-border/75 bg-state-warning-surface/92 text-state-warning-foreground";
  }

  if (tone === "review") {
    return "border-state-review-border/75 bg-state-review-surface/92 text-state-review-foreground";
  }

  return "border-border-strong/70 bg-surface-1 text-foreground";
}

function resolveActiveValueClassName(tone: SubscriptionSummaryCard["tone"] = "neutral") {
  if (tone === "danger") {
    return "text-state-danger-foreground";
  }

  if (tone === "stale") {
    return "text-state-warning-foreground";
  }

  if (tone === "review") {
    return "text-state-review-foreground";
  }

  return "text-foreground";
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
            "relative flex min-h-[96px] flex-col justify-between overflow-hidden rounded-lg border px-3.5 py-3 text-left transition-[border-color,background-color,color,box-shadow,transform] duration-150 sm:min-h-[108px] sm:px-4.5 sm:py-4",
            resolveCardClassName(card.tone),
            isPrimary && "shadow-[var(--subscriptions-summary-card-shadow)]",
            isPrimary && "col-span-2 lg:col-span-1",
            card.isActive ? resolveActiveCardClassName(card.tone) : "shadow-none",
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
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-x-0 top-0 h-1.5 transition-opacity duration-150",
                    resolveActiveAccentClassName(card.tone),
                    card.isActive ? "opacity-100" : "opacity-0",
                  )}
                />
                <div>
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <span className="block text-[11px] font-medium tracking-[0.14em] text-foreground-soft uppercase">
                      {card.label}
                    </span>
                    <span
                      data-testid="subscriptions-summary-card-badge-slot"
                      className="flex min-w-[4.75rem] justify-end"
                    >
                      <span
                        className={cn(
                          "inline-flex h-6 items-center rounded-full border border-border-strong/70 bg-surface-1 px-2.5 text-[10px] font-medium tracking-[0.12em] text-foreground uppercase shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]",
                          card.isActive && resolveActiveBadgeClassName(card.tone),
                          !card.isActive && "invisible",
                        )}
                        aria-hidden={card.isActive ? undefined : "true"}
                      >
                        表示中
                      </span>
                    </span>
                  </div>
                  <span
                    className={cn(
                      "mt-1.5 block text-[1.72rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[1.96rem]",
                      card.isActive && resolveActiveValueClassName(card.tone),
                    )}
                  >
                    {card.value}
                  </span>
                  {card.caption ? (
                    <p
                      className={cn(
                        "mt-1 max-w-[24ch] text-[12px] leading-5 text-foreground-soft sm:max-w-[26ch] sm:text-[13px] sm:leading-[1.5]",
                        card.isActive && "text-foreground",
                      )}
                    >
                      {card.caption}
                    </p>
                  ) : null}
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <LabelChip
                    tone="neutral"
                    className={cn(
                      "px-2 py-0.75 text-[10px] text-foreground-soft transition-colors group-hover:text-foreground",
                      card.isActive &&
                        "border-border-strong/75 bg-surface-1 text-foreground shadow-[0_0_0_1px_rgba(38,37,30,0.08)]",
                      isPrimary && !card.isActive && "bg-surface-1/88",
                    )}
                  >
                    {card.isActive ? "フィルタ中" : "絞り込む"}
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
