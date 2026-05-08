import { createElement } from "react";
import type { SidebarSmartViewsProps, SidebarSmartViewsPropsParams } from "../../sidebar.types";
import { SmartViewContextMenuContent } from "../../smart-view-context-menu";

export function useSidebarSmartViewsProps({
  t,
  selectedAccountId,
  visibleSmartViews,
  selectSmartView,
}: SidebarSmartViewsPropsParams): SidebarSmartViewsProps {
  const props: SidebarSmartViewsProps = {
    title: t("smart_views"),
    views: visibleSmartViews,
    onSelectSmartView: selectSmartView,
  };

  if (selectedAccountId) {
    props.renderContextMenu = (view) =>
      createElement(SmartViewContextMenuContent, { accountId: selectedAccountId, view });
  }

  return props;
}
