import { Button } from "@/components/ui/button";
import type { SubscriptionSummaryCard } from "./subscriptions-index.types";

export function SubscriptionsOverviewSummary({ cards }: { cards: SubscriptionSummaryCard[] }) {
  return (
    <section className="border-b border-border/70 bg-gradient-to-b from-card/60 to-background/90 px-4 py-4 sm:px-6">
      <div className="grid gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{card.value}</p>
            {card.actionLabel && card.onAction ? (
              <Button variant="ghost" className="-ml-3 mt-2 h-auto px-3 py-1 text-xs" onClick={card.onAction}>
                {card.actionLabel}
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
