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
      className="border-b border-border/70 px-4 py-4 sm:px-6"
      style={{ backgroundImage: "var(--subscriptions-summary-surface)" }}
    >
      <div className="grid gap-3 lg:grid-cols-4">
        {cards.map((card) => {
          const numericValue = Number(card.value);
          const hasAction = Boolean(card.actionLabel && card.onAction);
          const isActionable = hasAction && Number.isFinite(numericValue) && numericValue > 0;
          const helperText = hasAction ? card.actionLabel : undefined;
          const className = cn(
            "rounded-md border px-4 py-4 text-left shadow-[0_16px_40px_-34px_hsl(var(--foreground)/0.34)] transition-colors",
            resolveCardClassName(isActionable ? card.tone : "neutral"),
            !isActionable && card.actionLabel && "text-muted-foreground",
          );

          if (isActionable && card.actionLabel && card.onAction) {
            return (
              <button
                key={card.label}
                type="button"
                className={cn(className, "cursor-pointer hover:border-border-strong hover:bg-surface-1/94")}
                onClick={card.onAction}
              >
                <span className="block text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  {card.label}
                </span>
                <span className="mt-2 block text-3xl font-semibold tracking-tight text-foreground">{card.value}</span>
                {helperText ? (
                  <LabelChip tone="muted" className="mt-3 text-foreground/84">
                    {helperText}
                  </LabelChip>
                ) : null}
              </button>
            );
          }

          return (
            <div key={card.label} className={className}>
              <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">{card.label}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{card.value}</p>
              {helperText ? <p className="mt-3 text-sm text-muted-foreground">{helperText}</p> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
