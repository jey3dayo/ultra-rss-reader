import { SidebarAccountSection } from "./sidebar-account-section";
import { SidebarContentSections } from "./sidebar-content-sections";
import { SidebarHeaderView } from "./sidebar-header-view";
import { SmartViewsView } from "./smart-views-view";
import { useSidebarController } from "./use-sidebar-controller";

export function Sidebar() {
  const { sidebarClassName, headerProps, accountSectionProps, smartViewsProps, contentSectionsProps } =
    useSidebarController();

  return (
    <div className={sidebarClassName}>
      <SidebarHeaderView {...headerProps} />
      <SidebarAccountSection {...accountSectionProps} />
      <SmartViewsView {...smartViewsProps} />

      <div className="px-4 py-2">
        <div className="h-px bg-[var(--sidebar-divider-strong)]" />
      </div>

      <SidebarContentSections {...contentSectionsProps} />
    </div>
  );
}
