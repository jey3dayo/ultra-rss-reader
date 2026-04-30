import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { LabelChip } from "@/components/shared/label-chip";
import { cn } from "@/lib/utils";
import type { SubscriptionSummaryCard } from "./subscriptions-index.types";

type SubscriptionSummaryTone = NonNullable<SubscriptionSummaryCard["tone"]>;

const summaryToneClassNames = {
  neutral: {
    card: "border-border/60 bg-surface-1/62",
    activeCard:
      "border-border-strong bg-surface-1 shadow-[var(--subscriptions-summary-active-shadow-neutral)] ring-1 ring-[color:var(--subscriptions-summary-active-ring-neutral)]",
    activeAccent: "bg-secondary",
    activeBadge: "border-border-strong/70 bg-surface-1 text-foreground",
    activeValue: "text-foreground",
  },
  stale: {
    card: "border-state-warning-border/75 bg-state-warning-surface/84",
    activeCard:
      "border-state-warning-border/90 bg-state-warning-surface shadow-[var(--subscriptions-summary-active-shadow-stale)] ring-1 ring-[color:var(--subscriptions-summary-active-ring-stale)]",
    activeAccent: "bg-state-warning-border",
    activeBadge: "border-state-warning-border/75 bg-state-warning-surface/92 text-state-warning-foreground",
    activeValue: "text-state-warning-foreground",
  },
  review: {
    card: "border-state-review-border/80 bg-state-review-surface/86",
    activeCard:
      "border-state-review-border/95 bg-state-review-surface shadow-[var(--subscriptions-summary-active-shadow-review)] ring-1 ring-[color:var(--subscriptions-summary-active-ring-review)]",
    activeAccent: "bg-state-review-border",
    activeBadge: "border-state-review-border/75 bg-state-review-surface/92 text-state-review-foreground",
    activeValue: "text-state-review-foreground",
  },
} as const satisfies Record<
  SubscriptionSummaryTone,
  {
    card: string;
    activeCard: string;
    activeAccent: string;
    activeBadge: string;
    activeValue: string;
  }
>;

const summaryTextVariants = cva("", {
  variants: {
    variant: {
      label: "text-[11px] font-medium tracking-[0.14em] text-foreground-soft uppercase",
      actionableValue: "mt-1.5 block text-[1.72rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[1.96rem]",
      staticValue: "mt-2 text-[1.85rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[2.1rem]",
      actionableCaption:
        "mt-1 max-w-[24ch] text-[12px] leading-5 text-foreground-soft sm:max-w-[26ch] sm:text-[13px] sm:leading-[1.5]",
      staticCaption:
        "mt-1.5 max-w-[24ch] text-[13px] leading-5 text-foreground-soft sm:mt-2 sm:max-w-[26ch] sm:text-sm sm:leading-[1.55]",
    },
  },
});

type SummaryTextVariantProps = VariantProps<typeof summaryTextVariants>;

type SummaryTextProps = {
  as: "p" | "span";
  children: ReactNode;
  className?: string;
  variant: NonNullable<SummaryTextVariantProps["variant"]>;
};

function SummaryText({ as, children, className, variant }: SummaryTextProps) {
  const resolvedClassName = cn(summaryTextVariants({ variant }), className);

  if (as === "span") {
    return <span className={resolvedClassName}>{children}</span>;
  }

  return <p className={resolvedClassName}>{children}</p>;
}

function resolveSummaryToneClasses(tone: SubscriptionSummaryCard["tone"] = "neutral") {
  return summaryToneClassNames[tone ?? "neutral"];
}

type SummaryFilterCardButtonProps = {
  card: SubscriptionSummaryCard;
  className: string;
  isPrimary?: boolean;
  onSelectFilter: (filterKey: SubscriptionSummaryCard["filterKey"]) => void;
  toneClasses: (typeof summaryToneClassNames)[SubscriptionSummaryTone];
};

function resolveActiveBadgeLabel() {
  return "表示中";
}

function resolveActionChipLabel({
  filterKey,
  isActive,
}: {
  filterKey: SubscriptionSummaryCard["filterKey"];
  isActive?: boolean;
}) {
  if (isActive) {
    return filterKey === "all" ? "全件表示" : "フィルタ中";
  }

  return filterKey === "all" ? "すべて表示" : "絞り込む";
}

function SummaryFilterCardButton({
  card,
  className,
  isPrimary = false,
  onSelectFilter,
  toneClasses,
}: SummaryFilterCardButtonProps) {
  return (
    <button
      type="button"
      className={cn(className, "group cursor-pointer", "hover:border-border-strong/90")}
      aria-pressed={card.isActive}
      onClick={() => onSelectFilter(card.filterKey)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 top-0 h-1.5 transition-opacity duration-150",
          toneClasses.activeAccent,
          card.isActive ? "opacity-100" : "opacity-0",
        )}
      />
      <div>
        <div className="mb-2 flex items-start justify-between gap-3">
          <SummaryText as="span" variant="label" className="block">
            {card.label}
          </SummaryText>
          <span data-testid="subscriptions-summary-card-badge-slot" className="flex min-w-[4.75rem] justify-end">
            <span
              className={cn(
                "inline-flex h-6 items-center rounded-full border border-border-strong/70 bg-surface-1 px-2.5 text-[10px] font-medium tracking-[0.12em] text-foreground uppercase shadow-[var(--subscriptions-summary-badge-shadow)]",
                card.isActive && toneClasses.activeBadge,
                !card.isActive && "invisible",
              )}
              aria-hidden={card.isActive ? undefined : "true"}
            >
              {resolveActiveBadgeLabel()}
            </span>
          </span>
        </div>
        <SummaryText as="span" variant="actionableValue" className={cn(card.isActive && toneClasses.activeValue)}>
          {card.value}
        </SummaryText>
        {card.caption ? (
          <SummaryText as="p" variant="actionableCaption" className={cn(card.isActive && "text-foreground")}>
            {card.caption}
          </SummaryText>
        ) : null}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <LabelChip
          tone="neutral"
          className={cn(
            "px-2 py-0.75 text-[10px] text-foreground-soft transition-colors group-hover:text-foreground",
            card.isActive &&
              "border-border-strong/75 bg-surface-1 text-foreground shadow-[var(--subscriptions-summary-active-chip-shadow)]",
            isPrimary && !card.isActive && "bg-surface-1/88",
          )}
        >
          {resolveActionChipLabel({ filterKey: card.filterKey, isActive: card.isActive })}
        </LabelChip>
      </div>
    </button>
  );
}

export function SubscriptionsOverviewSummary({
  cards,
  onSelectFilter,
}: {
  cards: SubscriptionSummaryCard[];
  onSelectFilter: (filterKey: SubscriptionSummaryCard["filterKey"]) => void;
}) {
  return (
    <section
      className="rounded-lg border border-border/55 px-4 py-3 sm:px-5 sm:py-4"
      style={{
        backgroundColor: "var(--subscriptions-summary-surface)",
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-3.5">
        {cards.map((card) => {
          const numericValue = Number(card.value);
          const isActionable = Number.isFinite(numericValue);
          const isPrimary = card.tone === "review";
          const toneClasses = resolveSummaryToneClasses(card.tone);
          const className = cn(
            "motion-static-hover-surface relative flex min-h-[96px] w-full min-w-0 flex-col justify-between overflow-hidden rounded-lg border px-3.5 py-3 text-left sm:min-h-[108px] sm:px-4.5 sm:py-4",
            toneClasses.card,
            isPrimary && "shadow-[var(--subscriptions-summary-card-shadow)]",
            isPrimary && "sm:col-span-2 lg:col-span-1",
            card.isActive ? toneClasses.activeCard : "shadow-none",
          );

          if (isActionable) {
            return (
              <SummaryFilterCardButton
                key={card.label}
                card={card}
                className={className}
                isPrimary={isPrimary}
                onSelectFilter={onSelectFilter}
                toneClasses={toneClasses}
              />
            );
          }

          return (
            <div key={card.label} className={className}>
              <div>
                <SummaryText as="p" variant="label">
                  {card.label}
                </SummaryText>
                <SummaryText as="p" variant="staticValue">
                  {card.value}
                </SummaryText>
                {card.caption ? (
                  <SummaryText as="p" variant="staticCaption">
                    {card.caption}
                  </SummaryText>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
