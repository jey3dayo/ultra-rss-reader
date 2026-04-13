import { cn } from "@/lib/utils";
import type { SidebarViewPropsParams, SidebarViewPropsResult } from "./sidebar.types";

export function useSidebarViewProps({
  opaqueSidebars,
  headerProps,
  accountSectionProps,
  smartViewsProps,
  contentSectionsProps,
}: SidebarViewPropsParams): SidebarViewPropsResult {
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
