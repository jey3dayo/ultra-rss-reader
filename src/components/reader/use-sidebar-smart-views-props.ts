import type { SidebarSmartViewsProps, SidebarSmartViewsPropsParams } from "./sidebar.types";

export function useSidebarSmartViewsProps({
  t,
  visibleSmartViews,
  selectSmartView,
}: SidebarSmartViewsPropsParams): SidebarSmartViewsProps {
  return {
    title: t("smart_views"),
    views: visibleSmartViews,
    onSelectSmartView: selectSmartView,
  };
}
