import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import type { SidebarNavButtonProps } from "./sidebar.types";

export const SidebarNavButton = forwardRef<HTMLButtonElement, SidebarNavButtonProps>(
  (
    {
      children,
      className,
      contentClassName,
      selected = false,
      size = "compact",
      trailing,
      trailingClassName,
      type = "button",
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "relative flex w-full items-center justify-between overflow-hidden rounded-md px-2 text-sm transition-[background-color,color,box-shadow] duration-150 focus:outline-none focus-visible:bg-sidebar-accent/65 focus-visible:text-sidebar-foreground focus-visible:shadow-[inset_0_0_0_1px_hsl(var(--sidebar-border)/0.48)]",
          size === "default" ? "py-2" : "py-1.5",
          selected
            ? "bg-sidebar-accent/85 text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_hsl(var(--sidebar-border)/0.55)] before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-sidebar-primary"
            : "text-sidebar-foreground hover:bg-sidebar-accent/55",
          className,
        )}
        {...props}
      >
        <span className={cn("flex min-w-0 items-center gap-2", contentClassName)}>{children}</span>
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
