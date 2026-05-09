import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useSidebarController } from "@/components/reader/hooks/sidebar/use-sidebar-controller";
import { focusArticleListRowTargetWhenReady } from "@/lib/reader-focus";
import { useUiStore } from "@/stores/ui-store";
import { SidebarAccountSection } from "./sidebar-account-section";
import { SidebarContentSections } from "./sidebar-content-sections";
import { SidebarHeaderView } from "./sidebar-header-view";
import { SmartViewsView } from "./smart-views-view";

function getSidebarNavigationTargets() {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('[data-sidebar-navigation-target="true"]')).filter(
    (target) => !target.disabled && !target.closest('[aria-hidden="true"]'),
  );
}

function focusSidebarNavigationTarget(target: HTMLButtonElement) {
  target.click();
  useUiStore.getState().openSidebar();
  requestAnimationFrame(() => {
    const nextTarget = target.isConnected
      ? target
      : document.querySelector<HTMLButtonElement>('[data-sidebar-selected-target="true"]');
    nextTarget?.focus({ preventScroll: true });
    nextTarget?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  });
}

function focusArticleListPane() {
  const store = useUiStore.getState();
  store.setFocusedPane("list");
  focusArticleListRowTargetWhenReady(store.selectedArticleId);
}

function handleSidebarKeyDown(event: ReactKeyboardEvent<HTMLElement>, onFocusAccountList: () => void) {
  if (
    event.defaultPrevented ||
    (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "ArrowLeft" && event.key !== "ArrowRight")
  ) {
    return;
  }

  const target = event.target instanceof Element ? event.target : null;
  const currentTarget = target?.closest<HTMLButtonElement>('[data-sidebar-navigation-target="true"]');
  if (!currentTarget) {
    return;
  }

  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    event.stopPropagation();

    if (event.key === "ArrowLeft") {
      onFocusAccountList();
      return;
    }

    focusArticleListPane();
    return;
  }

  const targets = getSidebarNavigationTargets();
  const currentIndex = targets.indexOf(currentTarget);
  if (currentIndex < 0) {
    return;
  }

  const direction = event.key === "ArrowDown" ? 1 : -1;
  const nextTarget = targets[currentIndex + direction];
  if (!nextTarget) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  focusSidebarNavigationTarget(nextTarget);
}

export function Sidebar() {
  const { t } = useTranslation("reader");
  const { sidebarClassName, headerProps, accountSectionProps, smartViewsProps, contentSectionsProps } =
    useSidebarController();

  return (
    <nav
      aria-label={t("sidebar_landmark")}
      className={sidebarClassName}
      data-sidebar-pane="true"
      onKeyDown={(event) => handleSidebarKeyDown(event, contentSectionsProps.onFocusAccountList)}
    >
      <SidebarHeaderView {...headerProps} />
      <SidebarAccountSection {...accountSectionProps} />
      <SmartViewsView {...smartViewsProps} />

      <div className="px-4 py-2">
        <div className="h-px bg-[var(--sidebar-divider-strong)]" />
      </div>

      <SidebarContentSections {...contentSectionsProps} />
    </nav>
  );
}
