export const SIDEBAR_SELECTED_TARGET_ATTRIBUTE = "data-sidebar-selected-target";
export const SIDEBAR_FALLBACK_TARGET_ATTRIBUTE = "data-sidebar-fallback-target";

function focusElement(target: HTMLElement): boolean {
  if (target.hasAttribute("disabled")) {
    return false;
  }

  target.focus({ preventScroll: true });
  target.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  return true;
}

export function focusArticleListTarget(selectedArticleId: string | null): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  if (selectedArticleId) {
    const selectedArticleTarget = document.querySelector<HTMLElement>(`[data-article-id="${selectedArticleId}"]`);
    if (selectedArticleTarget && focusElement(selectedArticleTarget)) {
      return true;
    }
  }

  const listbox = document.querySelector<HTMLElement>('[data-article-list-root="true"]');
  return listbox ? focusElement(listbox) : false;
}

export function focusSelectedSidebarTarget(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  const selectedTarget =
    document.querySelector<HTMLElement>(`[${SIDEBAR_SELECTED_TARGET_ATTRIBUTE}="true"]`) ??
    document.querySelector<HTMLElement>(`[${SIDEBAR_FALLBACK_TARGET_ATTRIBUTE}="true"]`);

  return selectedTarget ? focusElement(selectedTarget) : false;
}
