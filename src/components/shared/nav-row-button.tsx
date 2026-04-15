import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type NavRowButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  tone?: "default" | "sidebar";
  selected?: boolean;
};

export function NavRowButton({
  title,
  description,
  leading,
  trailing,
  tone = "default",
  selected = false,
  className,
  type = "button",
  ...props
}: NavRowButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "group flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-[color,background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        tone === "sidebar"
          ? "focus-visible:bg-sidebar-accent/65 focus-visible:text-sidebar-foreground"
          : "border focus-visible:border-border-strong focus-visible:bg-surface-2/90",
        tone === "sidebar"
          ? selected
            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_var(--color-sidebar-border)]"
            : "text-sidebar-foreground/88 hover:bg-sidebar-accent/72 hover:text-sidebar-foreground"
          : selected
            ? "border-border-strong bg-surface-1 text-foreground shadow-elevation-1"
            : "border-transparent bg-transparent text-foreground hover:border-border hover:bg-surface-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{title}</div>
        {description ? <div className="mt-1 text-xs text-foreground-soft">{description}</div> : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </button>
  );
}
