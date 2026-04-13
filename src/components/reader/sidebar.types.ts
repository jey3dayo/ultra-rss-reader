import type { SidebarAccountSectionProps } from "./sidebar-account-section";
import type { SidebarContentSectionsProps } from "./sidebar-content-sections";
import type { SidebarHeaderViewProps } from "./sidebar-header-view";
import type { SmartViewsViewProps } from "./smart-views-view";

export type SidebarHeaderProps = SidebarHeaderViewProps;
export type SidebarAccountProps = SidebarAccountSectionProps;
export type SidebarContentProps = SidebarContentSectionsProps;

export type SidebarSectionPropsResult = {
  headerProps: SidebarHeaderProps;
  accountSectionProps: SidebarAccountProps;
  smartViewsProps: SmartViewsViewProps;
  contentSectionsProps: SidebarContentProps;
};

export type SidebarViewPropsResult = SidebarSectionPropsResult & {
  sidebarClassName: string;
};

export type SidebarControllerResult = SidebarViewPropsResult;
