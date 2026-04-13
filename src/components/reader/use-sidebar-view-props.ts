import { cn } from "@/lib/utils";
import type { SidebarAccountSection } from "./sidebar-account-section";
import type { SidebarContentSections } from "./sidebar-content-sections";
import type { SidebarHeaderView } from "./sidebar-header-view";
import type { SmartViewsViewProps } from "./smart-views-view";

type SidebarHeaderProps = Parameters<typeof SidebarHeaderView>[0];
type SidebarAccountSectionProps = Parameters<typeof SidebarAccountSection>[0];
type SidebarContentSectionsProps = Parameters<typeof SidebarContentSections>[0];

type UseSidebarViewPropsParams = {
  opaqueSidebars: boolean;
  headerProps: SidebarHeaderProps;
  accountSectionProps: SidebarAccountSectionProps;
  smartViewsProps: SmartViewsViewProps;
  contentSectionsProps: SidebarContentSectionsProps;
};

export function useSidebarViewProps({
  opaqueSidebars,
  headerProps,
  accountSectionProps,
  smartViewsProps,
  contentSectionsProps,
}: UseSidebarViewPropsParams) {
  return {
    sidebarClassName: cn(
      "flex h-full flex-col border-r border-border bg-sidebar text-sidebar-foreground",
      opaqueSidebars && "bg-opacity-100",
    ),
    headerProps,
    accountSectionProps,
    smartViewsProps,
    contentSectionsProps,
  };
}
