import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ReactNode } from "react";
import { MOTION_CONTENT_SWAP_CLASS_NAME, MOTION_DATA_PHASE_ATTRIBUTE, MOTION_PHASE_ENTERING } from "@/constants/motion";
import type { SubscriptionSummaryCard } from "@/lib/subscriptions/subscriptions-index.types";
import { type SubscriptionsLoadFailure, SubscriptionsLoadFailureBanner } from "./subscriptions-load-status";

type SubscriptionSummaryTone = NonNullable<SubscriptionSummaryCard["tone"]>;

const dangerToneClassNames = {
  card: "border-state-danger-border/72 bg-state-danger-surface/82",
  activeCard:
    "border-state-danger-border/90 bg-state-danger-surface shadow-[var(--subscriptions-summary-active-shadow-stale)]",
  activeAccent: "bg-state-danger-border",
  activeBadge: "border-state-danger-border/75 bg-state-danger-surface/92 text-state-danger-foreground",
  activeValue: "text-state-danger-foreground",
} as const;

const summaryToneClassNames = {
  neutral: {
    card: "border-[color:color-mix(in_srgb,var(--ring)_22%,var(--border))] bg-[color:color-mix(in_srgb,var(--ring)_6%,var(--surface-1))]",
    activeCard:
      "border-[color:color-mix(in_srgb,var(--ring)_46%,var(--border-strong))] bg-[color:color-mix(in_srgb,var(--ring)_10%,var(--surface-1))] shadow-[var(--subscriptions-summary-active-shadow-neutral)]",
    activeAccent: "bg-ring",
    activeBadge:
      "border-[color:color-mix(in_srgb,var(--ring)_42%,var(--border-strong))] bg-[color:color-mix(in_srgb,var(--ring)_10%,var(--surface-1))] text-foreground",
    activeValue: "text-foreground",
  },
  stale: dangerToneClassNames,
  danger: dangerToneClassNames,
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
      label: "system-micro text-foreground-soft",
      actionableValue: "mt-1 block text-[1.42rem] font-semibold tracking-[-0.032em] text-foreground sm:text-[1.58rem]",
      staticValue: "mt-1 text-[1.36rem] font-semibold tracking-[-0.03em] text-foreground sm:text-[1.48rem]",
      actionableCaption:
        "mt-0.5 max-w-[28ch] text-(length:--font-size-xs) leading-[1.35] text-foreground-soft sm:max-w-[30ch] sm:text-(length:--font-size-xs)",
      staticCaption:
        "mt-0.5 max-w-[28ch] text-(length:--font-size-xs) leading-[1.35] text-foreground-soft sm:max-w-[30ch] sm:text-(length:--font-size-xs)",
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

function canSelectSummaryFilterCard(card: SubscriptionSummaryCard) {
  return card.isActionable ?? true;
}

type SummaryFilterCardButtonProps = {
  labels: SubscriptionsOverviewSummaryLabels;
  onSelect: (filterKey: SubscriptionSummaryCard["filterKey"]) => void;
  renderValue?: (card: SubscriptionSummaryCard) => ReactNode;
  summaryCard: SubscriptionSummaryCard;
};

type SummaryCardViewState = {
  className: string;
  isActionable: boolean;
  toneClasses: (typeof summaryToneClassNames)[SubscriptionSummaryTone];
};

type SummaryCardRenderModel = {
  value: ReactNode;
  viewState: SummaryCardViewState;
};

export type SubscriptionsOverviewSummaryLabels = {
  activeBadge: string;
  staticBadge: string;
  showFilterAriaLabel: (label: string) => string;
  filterAll: string;
  filter: string;
};

const DEFAULT_SUMMARY_LABELS: SubscriptionsOverviewSummaryLabels = {
  activeBadge: "表示中",
  staticBadge: "参照",
  showFilterAriaLabel: (label) => `${label} を表示`,
  filterAll: "すべて表示",
  filter: "絞り込む",
};

function isZeroCountAttentionCard(card: SubscriptionSummaryCard) {
  return card.filterKey === "stale" && isNumericSummaryValue(card.value) && Number(card.value) === 0;
}

function resolveSummaryCardViewState(card: SubscriptionSummaryCard): SummaryCardViewState {
  const isActionable = canSelectSummaryFilterCard(card);
  const isActiveActionable = isActionable && Boolean(card.isActive);
  const displayTone = isZeroCountAttentionCard(card) ? "neutral" : card.tone;
  const toneClasses = resolveSummaryToneClasses(displayTone);

  return {
    className: cn(
      "motion-static-hover-surface relative flex min-h-[76px] w-full min-w-0 flex-col justify-between overflow-hidden rounded-md border px-3.5 py-2.5 text-left sm:min-h-[84px] sm:px-4 sm:py-3",
      toneClasses.card,
      isActiveActionable ? toneClasses.activeCard : "shadow-none",
    ),
    isActionable,
    toneClasses,
  };
}

function resolveActiveBadgeLabel(labels: SubscriptionsOverviewSummaryLabels) {
  return labels.activeBadge;
}

function resolveStaticBadgeLabel(labels: SubscriptionsOverviewSummaryLabels) {
  return labels.staticBadge;
}

function resolveSummaryFilterCardAriaLabel(card: SubscriptionSummaryCard, labels: SubscriptionsOverviewSummaryLabels) {
  return labels.showFilterAriaLabel(card.label);
}

function resolveActionChipLabel({
  filterKey,
  labels,
}: {
  filterKey: SubscriptionSummaryCard["filterKey"];
  labels: SubscriptionsOverviewSummaryLabels;
}) {
  return filterKey === "all" ? labels.filterAll : labels.filter;
}

function isNumericSummaryValue(value: string) {
  return value.trim() !== "" && !Number.isNaN(Number(value));
}

function renderDefaultSummaryValue(card: SubscriptionSummaryCard) {
  if (isNumericSummaryValue(card.value)) {
    return <span className="tabular-nums">{card.value}</span>;
  }

  return card.value;
}

function buildSummaryCardRenderModel(params: {
  card: SubscriptionSummaryCard;
  renderValue?: (card: SubscriptionSummaryCard) => ReactNode;
}): SummaryCardRenderModel {
  const { card, renderValue } = params;
  return {
    value: renderValue?.(card) ?? renderDefaultSummaryValue(card),
    viewState: resolveSummaryCardViewState(card),
  };
}

function SummaryFilterCardButton({ labels, onSelect, renderValue, summaryCard }: SummaryFilterCardButtonProps) {
  const {
    value,
    viewState: { className: cardClassName, toneClasses },
  } = buildSummaryCardRenderModel({
    card: summaryCard,
    renderValue,
  });
  const isZeroAttention = isZeroCountAttentionCard(summaryCard);

  return (
    <button
      type="button"
      className={cn(
        cardClassName,
        "group cursor-pointer hover:border-border-strong/90 focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
      )}
      aria-description={resolveSummaryFilterCardAriaLabel(summaryCard, labels)}
      aria-pressed={Boolean(summaryCard.isActive)}
      onClick={() => onSelect(summaryCard.filterKey)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 top-0 h-1 transition-opacity duration-150",
          toneClasses.activeAccent,
          summaryCard.isActive ? "opacity-100" : "opacity-0",
        )}
      />
      <div>
        <div className="mb-1.5 flex items-start justify-between gap-3">
          <SummaryText as="span" variant="label" className="block">
            {summaryCard.label}
          </SummaryText>
          <span data-testid="subscriptions-summary-card-badge-slot" className="flex min-w-[3.75rem] justify-end">
            <span
              className={cn(
                "inline-flex h-5 items-center rounded-full border border-border-strong/70 bg-surface-1 px-2 system-micro text-foreground shadow-[var(--subscriptions-summary-badge-shadow)]",
                summaryCard.isActive && toneClasses.activeBadge,
                !summaryCard.isActive && "invisible",
              )}
              aria-hidden={summaryCard.isActive ? undefined : "true"}
            >
              {resolveActiveBadgeLabel(labels)}
            </span>
          </span>
        </div>
        <div
          key={`${summaryCard.filterKey}-${summaryCard.isActive ? "active" : "idle"}`}
          className={cn(
            summaryCard.isActive && MOTION_CONTENT_SWAP_CLASS_NAME,
            summaryCard.isActive && "[--motion-content-swap-offset:2px]",
          )}
          {...(summaryCard.isActive ? { [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING } : {})}
        >
          <SummaryText
            as="span"
            variant="actionableValue"
            className={cn(summaryCard.isActive && toneClasses.activeValue)}
          >
            {value}
          </SummaryText>
        </div>
        {summaryCard.caption ? (
          <SummaryText as="p" variant="actionableCaption" className={cn(summaryCard.isActive && "text-foreground")}>
            {summaryCard.caption}
          </SummaryText>
        ) : null}
      </div>
      {!summaryCard.isActive && !isZeroAttention ? (
        <span className="sr-only">{resolveActionChipLabel({ filterKey: summaryCard.filterKey, labels })}</span>
      ) : null}
    </button>
  );
}

type SubscriptionsOverviewSummaryProps = {
  cards: SubscriptionSummaryCard[];
  labels?: SubscriptionsOverviewSummaryLabels;
  loadFailure?: SubscriptionsLoadFailure | null;
  onSelectFilter: (filterKey: SubscriptionSummaryCard["filterKey"]) => void;
  renderValue?: (card: SubscriptionSummaryCard) => ReactNode;
};

export function SubscriptionsOverviewSummary({
  cards,
  labels = DEFAULT_SUMMARY_LABELS,
  loadFailure = null,
  onSelectFilter,
  renderValue,
}: SubscriptionsOverviewSummaryProps) {
  return (
    <section className="p-0 shadow-none">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] lg:gap-3">
        {cards.map((card) => {
          const { value, viewState } = buildSummaryCardRenderModel({ card, renderValue });

          if (viewState.isActionable) {
            return (
              <SummaryFilterCardButton
                key={card.label}
                labels={labels}
                onSelect={onSelectFilter}
                renderValue={renderValue}
                summaryCard={card}
              />
            );
          }

          return (
            <div
              key={card.label}
              data-subscriptions-summary-static-card=""
              className={cn(viewState.className, "shadow-none")}
            >
              <div>
                <div className="mb-2 flex min-h-6 items-start justify-between gap-3">
                  <SummaryText as="p" variant="label">
                    {card.label}
                  </SummaryText>
                  <span className="rounded-full border border-border/55 bg-background/70 px-2.5 py-1 text-(length:--font-size-2xs) font-medium tracking-[0.12em] text-foreground-soft">
                    {resolveStaticBadgeLabel(labels)}
                  </span>
                </div>
                <SummaryText as="p" variant="staticValue" className="text-foreground-soft">
                  {value}
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
      {loadFailure ? (
        <div className="mt-3">
          <SubscriptionsLoadFailureBanner failure={loadFailure} testId="subscriptions-summary-load-error" />
        </div>
      ) : null}
    </section>
  );
}
