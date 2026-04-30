import { forwardRef } from "react";
import { MotionNumber } from "@/components/shared/motion-number";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import type { SidebarNavButtonProps } from "./sidebar.types";
import { getSidebarDensityTokens } from "./sidebar-density";

export const SidebarNavButton = forwardRef<HTMLButtonElement, SidebarNavButtonProps>(
  (
    {
      children,
      className,
      contentClassName,
      selected = false,
      activePane: activePaneProp,
      selectedIndicatorMode = "always",
      size = "compact",
      density = "normal",
      trailing,
      trailingClassName,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const tokens = getSidebarDensityTokens(density);
    const focusedPane = useUiStore((state) => state.focusedPane);
    const activePane = activePaneProp ?? focusedPane === "sidebar";
    const trailingClassNames = cn(
      "ml-3 shrink-0 text-[0.75rem] font-medium text-[var(--sidebar-foreground-muted-strong)]",
      selected && activePane && "text-[var(--sidebar-selection-muted)]",
      trailingClassName,
    );

    return (
      <button
        ref={ref}
        type={type}
        data-sidebar-navigation-target="true"
        data-active-pane={selected ? String(activePane) : undefined}
        className={cn(
          "motion-contextual-surface relative flex w-full items-center justify-between overflow-hidden rounded-md text-sm select-none transition-[background-color,color,box-shadow] duration-150 focus:outline-none",
          tokens.navButtonPaddingX,
          size === "default" ? "min-h-10 py-2" : tokens.navButton,
          selected
            ? cn(
                activePane
                  ? "bg-[linear-gradient(90deg,var(--sidebar-selection-background)_0%,color-mix(in_srgb,var(--sidebar-selection-background)_68%,var(--sidebar-hover-surface))_100%)] text-[var(--sidebar-selection-foreground)] focus-visible:bg-[linear-gradient(90deg,var(--sidebar-selection-background)_0%,color-mix(in_srgb,var(--sidebar-selection-background)_68%,var(--sidebar-hover-surface))_100%)]"
                  : "bg-[linear-gradient(90deg,var(--sidebar-hover-surface)_0%,color-mix(in_srgb,var(--sidebar-hover-surface)_68%,transparent)_100%)] text-[var(--sidebar-foreground-strong)] focus-visible:bg-[linear-gradient(90deg,var(--sidebar-hover-surface)_0%,color-mix(in_srgb,var(--sidebar-hover-surface)_68%,transparent)_100%)]",
                selectedIndicatorMode !== "hidden" &&
                  cn(
                    "before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:transition-opacity before:duration-150",
                    activePane ? "before:bg-primary/85" : "before:bg-border-strong/70 before:opacity-70",
                  ),
                selectedIndicatorMode === "hide-on-row-hover" &&
                  "group-hover/feed-row:before:opacity-0 group-focus-within/feed-row:before:opacity-0",
              )
            : "text-[var(--sidebar-foreground-strong)] hover:bg-[var(--sidebar-hover-surface)] hover:text-[var(--sidebar-selection-foreground)] focus-visible:bg-[linear-gradient(90deg,var(--sidebar-hover-surface)_0%,color-mix(in_srgb,var(--sidebar-hover-surface)_58%,transparent)_100%)] focus-visible:text-[var(--sidebar-selection-foreground)]",
          className,
        )}
        {...props}
      >
        <span
          className={cn("flex min-w-0 flex-1 items-center justify-start", tokens.navButtonContentGap, contentClassName)}
        >
          {children}
        </span>
        {trailing ? (
          typeof trailing === "string" || typeof trailing === "number" ? (
            <MotionNumber key={trailing} value={trailing} className={trailingClassNames} />
          ) : (
            <span className={trailingClassNames}>{trailing}</span>
          )
        ) : null}
      </button>
    );
  },
);

SidebarNavButton.displayName = "SidebarNavButton";
