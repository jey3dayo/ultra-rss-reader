import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type NavRowButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  tone?: "default" | "sidebar";
  selected?: boolean;
};

export const NavRowButton = forwardRef<HTMLButtonElement, NavRowButtonProps>(
  (
    { title, description, leading, trailing, tone = "default", selected = false, className, type = "button", ...props },
    ref,
  ) => {
    const trailingMotionKey =
      typeof trailing === "string" || typeof trailing === "number" ? String(trailing) : undefined;

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "motion-interactive-surface motion-contextual-surface group flex w-full items-start gap-3 rounded-md px-3 py-2 text-left select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          tone === "sidebar"
            ? "focus-visible:bg-sidebar-accent/65 focus-visible:text-sidebar-foreground"
            : "border focus-visible:border-border-strong focus-visible:bg-surface-2/90",
          tone === "sidebar"
            ? selected
              ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[var(--sidebar-selection-inset-shadow)]"
              : "text-sidebar-foreground/88 hover:bg-[var(--sidebar-hover-surface)] hover:text-sidebar-foreground"
            : selected
              ? "border-border-strong bg-surface-1 text-foreground shadow-elevation-1"
              : "border-transparent bg-transparent text-foreground hover:border-border hover:bg-surface-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="truncate font-medium leading-[1.3]">{title}</div>
          {description ? <div className="text-xs leading-[1.35] text-foreground-soft">{description}</div> : null}
        </div>
        {trailing ? (
          <div className="shrink-0">
            <span
              key={trailingMotionKey}
              data-motion-phase={trailingMotionKey ? "entering" : undefined}
              className="motion-content-swap tabular-nums"
            >
              {trailing}
            </span>
          </div>
        ) : null}
      </button>
    );
  },
);

NavRowButton.displayName = "NavRowButton";
