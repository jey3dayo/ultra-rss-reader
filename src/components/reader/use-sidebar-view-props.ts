import { cn } from "@/lib/utils";
import type {
  SidebarAccountProps,
  SidebarContentProps,
  SidebarHeaderProps,
  SidebarViewPropsResult,
} from "./sidebar.types";
import type { SmartViewsViewProps } from "./smart-views-view";

type UseSidebarViewPropsParams = {
  opaqueSidebars: boolean;
  headerProps: SidebarHeaderProps;
  accountSectionProps: SidebarAccountProps;
  smartViewsProps: SmartViewsViewProps;
  contentSectionsProps: SidebarContentProps;
};

export function useSidebarViewProps({
  opaqueSidebars,
  headerProps,
  accountSectionProps,
  smartViewsProps,
  contentSectionsProps,
}: UseSidebarViewPropsParams): SidebarViewPropsResult {
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
