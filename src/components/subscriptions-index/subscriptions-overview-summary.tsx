import { cn } from "@/lib/utils";
import type { SubscriptionSummaryCard } from "./subscriptions-index.types";

function resolveCardClassName(tone: SubscriptionSummaryCard["tone"] = "neutral") {
  if (tone === "danger") {
    return "border-rose-500/25 bg-[linear-gradient(180deg,hsl(var(--destructive)/0.16),hsl(var(--background)/0.9))]";
  }

  if (tone === "stale") {
    return "border-amber-500/25 bg-[linear-gradient(180deg,hsl(38_92%_50%/0.16),hsl(var(--background)/0.9))]";
  }

  if (tone === "review") {
    return "border-primary/25 bg-[linear-gradient(180deg,hsl(var(--primary)/0.16),hsl(var(--background)/0.9))]";
  }

  return "border-border/70 bg-[linear-gradient(180deg,hsl(var(--card)/0.88),hsl(var(--background)/0.94))]";
}

export function SubscriptionsOverviewSummary({ cards }: { cards: SubscriptionSummaryCard[] }) {
  return (
    <section className="border-b border-border/70 bg-gradient-to-b from-card/60 to-background/90 px-4 py-4 sm:px-6">
      <div className="grid gap-3 lg:grid-cols-4">
        {cards.map((card) => {
          const numericValue = Number(card.value);
          const hasAction = Boolean(card.actionLabel && card.onAction);
          const isActionable = hasAction && Number.isFinite(numericValue) && numericValue > 0;
          const helperText = hasAction ? card.actionLabel : undefined;
          const className = cn(
            "rounded-3xl border px-4 py-3 text-left shadow-[0_18px_48px_-36px_hsl(var(--foreground)/0.45)] transition-colors",
            resolveCardClassName(isActionable ? card.tone : "neutral"),
            !isActionable && card.actionLabel && "opacity-65",
          );

          if (isActionable && card.actionLabel && card.onAction) {
            return (
              <button
                key={card.label}
                type="button"
                className={cn(className, "hover:border-primary/35 hover:bg-card/95")}
                onClick={card.onAction}
              >
                <span className="block text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  {card.label}
                </span>
                <span className="mt-2 block text-3xl font-semibold tracking-tight text-foreground">{card.value}</span>
                {helperText ? <span className="mt-3 block text-sm text-foreground/85">{helperText}</span> : null}
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
