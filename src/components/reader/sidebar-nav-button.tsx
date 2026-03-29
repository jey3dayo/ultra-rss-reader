import { type ComponentPropsWithoutRef, forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type SidebarNavButtonProps = ComponentPropsWithoutRef<"button"> & {
  children?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
  size?: "default" | "compact";
  contentClassName?: string;
  trailingClassName?: string;
};

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
          "flex w-full items-center justify-between rounded-md px-2 text-sm",
          size === "default" ? "py-2" : "py-1.5",
          selected ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50",
          className,
        )}
        {...props}
      >
        <span className={cn("flex min-w-0 items-center gap-2", contentClassName)}>{children}</span>
        {trailing ? (
          <span className={cn("ml-2 shrink-0 text-muted-foreground", trailingClassName)}>{trailing}</span>
        ) : null}
      </button>
    );
  },
);

SidebarNavButton.displayName = "SidebarNavButton";
