import type { TFunction } from "i18next";
import type { SmartViewsViewProps } from "./smart-views-view";

type UseSidebarSmartViewsPropsParams = {
  t: TFunction<"sidebar">;
  visibleSmartViews: SmartViewsViewProps["views"];
  selectSmartView: SmartViewsViewProps["onSelectSmartView"];
};

export function useSidebarSmartViewsProps({
  t,
  visibleSmartViews,
  selectSmartView,
}: UseSidebarSmartViewsPropsParams): SmartViewsViewProps {
  return {
    title: t("smart_views"),
    views: visibleSmartViews,
    onSelectSmartView: selectSmartView,
  };
}
