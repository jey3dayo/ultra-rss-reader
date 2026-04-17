import { cn } from "@/lib/utils";

export const WORKSPACE_DETAIL_PANE_WIDTH = 480;

export const WORKSPACE_DETAIL_PANE_GRID_CLASS = "lg:grid-cols-[minmax(0,1fr)_480px]";
export const WORKSPACE_DETAIL_PANE_GRID_CLASS_COMPACT = "grid-cols-[minmax(0,1fr)_480px]";

export const WORKSPACE_CANVAS_CLASS = "mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col";
export const WORKSPACE_CHROME_SPACING_CLASS = "flex min-h-0 flex-1 flex-col px-3 pb-3 sm:px-5 sm:pb-5";

export function workspaceSplitShellClassName(extraClassName?: string) {
  return cn(
    "mt-3 grid min-h-0 overflow-visible rounded-md border border-border/70 lg:mt-4 lg:flex-1 lg:overflow-hidden",
    WORKSPACE_DETAIL_PANE_GRID_CLASS,
    extraClassName,
  );
}

export function workspaceSplitGridClassName(extraClassName?: string) {
  return cn(
    "grid min-h-0 flex-1 items-stretch overflow-hidden",
    WORKSPACE_DETAIL_PANE_GRID_CLASS_COMPACT,
    extraClassName,
  );
}
