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

  return "border-border/70 bg-[linear-gradient(180deg,hsl(var(--card)/0.9),hsl(var(--background)/0.96))]";
}

export function SubscriptionsOverviewSummary({ cards }: { cards: SubscriptionSummaryCard[] }) {
  return (
    <section
      className="border-b border-border/70 px-4 py-4 sm:px-5"
      style={{ backgroundImage: "var(--subscriptions-summary-surface)" }}
    >
      <div className="grid gap-3 lg:grid-cols-[0.95fr_1.18fr_0.94fr_0.94fr]">
        {cards.map((card) => {
          const numericValue = Number(card.value);
          const hasAction = Boolean(card.actionLabel && card.onAction);
          const isActionable = hasAction && Number.isFinite(numericValue) && numericValue > 0;
          const isPrimary = isActionable && card.tone === "review";
          const className = cn(
            "rounded-md border px-4 py-4 text-left transition-[border-color,background-color,color,box-shadow] duration-150",
            resolveCardClassName(isActionable ? card.tone : "neutral"),
            isPrimary ? "shadow-[var(--subscriptions-summary-card-shadow)]" : "shadow-none",
            !isActionable && card.actionLabel && "text-muted-foreground opacity-80",
          );

          if (isActionable && card.actionLabel && card.onAction) {
            return (
              <button
                key={card.label}
                type="button"
                className={cn(
                  className,
                  "group cursor-pointer",
                  isPrimary ? "hover:border-border-strong hover:shadow-elevation-1" : "hover:border-border-strong/90",
                )}
                onClick={card.onAction}
              >
                <span className="block text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  {card.label}
                </span>
                <span className="mt-2 block text-[2rem] font-semibold tracking-tight text-foreground">{card.value}</span>
                {card.caption ? <p className="mt-1.5 text-sm text-muted-foreground">{card.caption}</p> : null}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <LabelChip
                    tone={isPrimary ? "neutral" : "muted"}
                    className={cn(
                      "text-foreground-soft transition-colors group-hover:text-foreground",
                      isPrimary && "bg-surface-1/88",
                    )}
                  >
                    {card.actionLabel}
                  </LabelChip>
                  <span className="text-[11px] text-foreground-soft transition-colors group-hover:text-foreground">
                    開く
                  </span>
                </div>
              </button>
            );
          }

          return (
            <div key={card.label} className={className}>
              <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">{card.label}</p>
              <p className="mt-2 text-[2rem] font-semibold tracking-tight text-foreground">{card.value}</p>
              {card.caption ? <p className="mt-1.5 text-sm text-foreground-soft">{card.caption}</p> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
