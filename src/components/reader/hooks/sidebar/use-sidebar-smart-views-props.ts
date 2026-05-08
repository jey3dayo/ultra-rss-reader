import { createElement } from "react";
import type { SidebarSmartViewsPropsParams } from "../../sidebar.types";
import { SmartViewContextMenuContent } from "../../smart-view-context-menu";
import type { SidebarSmartViewsProps } from "../../smart-views-view";

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
