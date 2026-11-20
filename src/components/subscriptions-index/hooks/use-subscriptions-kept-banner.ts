import { useTranslation } from "react-i18next";
import { resolveSubscriptionKeptBannerMode } from "@/lib/subscriptions/subscription-kept-visibility";
import type { SubscriptionSummaryFilterKey } from "@/lib/subscriptions/subscriptions-index.types";
import type { SubscriptionsKeptBanner } from "../subscriptions-kept-banner";

type UseSubscriptionsKeptBannerParams = {
  activeSummaryFilter: SubscriptionSummaryFilterKey;
  showKept: boolean;
  hiddenKeptCount: number;
  existingKeptCount: number;
  onToggleShowKept: () => void;
  onRequestReset: (keptCount: number) => void;
};

export function useSubscriptionsKeptBanner({
  activeSummaryFilter,
  showKept,
  hiddenKeptCount,
  existingKeptCount,
  onToggleShowKept,
  onRequestReset,
}: UseSubscriptionsKeptBannerParams): SubscriptionsKeptBanner | null {
  const { t } = useTranslation("subscriptions");

  if (existingKeptCount === 0) {
    return null;
  }

  const common = {
    resetLabel: t("kept_banner_reset"),
    onReset: () => onRequestReset(existingKeptCount),
  };
  switch (resolveSubscriptionKeptBannerMode({ activeSummaryFilter, showKept, hiddenKeptCount })) {
    case "hidden":
      return {
        ...common,
        message: t("kept_banner_hidden", { count: hiddenKeptCount }),
        toggle: { label: t("kept_banner_show"), onClick: onToggleShowKept },
      };
    case "shown":
      return {
        ...common,
        message: t("kept_banner_shown", { count: hiddenKeptCount }),
        toggle: { label: t("kept_banner_hide"), onClick: onToggleShowKept },
      };
    case "summary":
      return { ...common, message: t("kept_banner_summary", { count: existingKeptCount }), toggle: null };
  }
}
