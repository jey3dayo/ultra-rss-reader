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

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "relative flex w-full items-center justify-between overflow-hidden rounded-md text-sm transition-[background-color,color,box-shadow] duration-150 focus:outline-none focus-visible:bg-sidebar-accent/65 focus-visible:text-sidebar-foreground focus-visible:shadow-[inset_0_0_0_1px_hsl(var(--sidebar-border)/0.48)]",
          tokens.navButtonPaddingX,
          size === "default" ? "min-h-10 py-2" : tokens.navButton,
          selected
            ? "bg-sidebar-accent/85 text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_hsl(var(--sidebar-border)/0.55)] before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-sidebar-primary"
            : "text-sidebar-foreground hover:bg-sidebar-accent/55",
          className,
        )}
        {...props}
      >
        <span className={cn("flex min-w-0 items-center", tokens.navButtonContentGap, contentClassName)}>
          {children}
        </span>
        {trailing ? (
          <span
            className={cn(
              "ml-3 shrink-0 text-[0.78rem] tabular-nums text-sidebar-foreground/45",
              selected && "text-sidebar-accent-foreground/72",
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
