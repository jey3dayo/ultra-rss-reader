import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import type { SidebarNavButtonProps } from "./sidebar.types";
import { getSidebarDensityTokens } from "./sidebar-density";

export const SidebarNavButton = forwardRef<HTMLButtonElement, SidebarNavButtonProps>(
  (
    {
      children,
      className,
      contentClassName,
      selected = false,
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
    const trailingMotionKey =
      typeof trailing === "string" || typeof trailing === "number" ? String(trailing) : undefined;

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "motion-contextual-surface relative flex w-full items-center justify-between overflow-hidden rounded-md text-sm select-none transition-[background-color,color,box-shadow] duration-150 focus:outline-none focus-visible:bg-[var(--sidebar-selection-background)] focus-visible:text-[var(--sidebar-selection-foreground)] focus-visible:shadow-[var(--sidebar-selection-shadow)]",
          tokens.navButtonPaddingX,
          size === "default" ? "min-h-10 py-2" : tokens.navButton,
          selected
            ? cn(
                "bg-[var(--sidebar-selection-background)] text-[var(--sidebar-selection-foreground)] shadow-[var(--sidebar-selection-shadow)]",
                selectedIndicatorMode !== "hidden" &&
                  "before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary/85 before:transition-opacity before:duration-150",
                selectedIndicatorMode === "hide-on-row-hover" &&
                  "group-hover/feed-row:before:opacity-0 group-focus-within/feed-row:before:opacity-0",
              )
            : "text-[var(--sidebar-foreground-strong)] hover:bg-[var(--sidebar-hover-surface)] hover:text-[var(--sidebar-selection-foreground)]",
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
          <span
            key={trailingMotionKey}
            data-motion-phase={trailingMotionKey ? "entering" : undefined}
            className={cn(
              "motion-content-swap ml-3 shrink-0 text-[0.78rem] font-medium tabular-nums text-[var(--sidebar-foreground-muted-strong)]",
              selected && "text-[var(--sidebar-selection-muted)]",
              trailingClassName,
            )}
          >
            {trailing}
          </span>
        ) : null}
      </button>
    );
  },
);

SidebarNavButton.displayName = "SidebarNavButton";
