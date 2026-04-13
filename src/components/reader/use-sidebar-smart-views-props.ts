import type { SidebarSmartViewsPropsParams } from "./sidebar.types";
import type { SmartViewsViewProps } from "./smart-views-view";

export function useSidebarSmartViewsProps({
  t,
  visibleSmartViews,
  selectSmartView,
}: SidebarSmartViewsPropsParams): SmartViewsViewProps {
  return {
    title: t("smart_views"),
    views: visibleSmartViews,
    onSelectSmartView: selectSmartView,
  };
}
