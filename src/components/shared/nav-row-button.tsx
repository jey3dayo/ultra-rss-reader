import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type NavRowButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
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
        "group flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left transition-[background-color,border-color,color,box-shadow] duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        tone === "sidebar"
          ? "focus-visible:bg-sidebar-accent/65 focus-visible:text-sidebar-foreground"
          : "focus-visible:border-border/70 focus-visible:bg-card/45",
        tone === "sidebar"
          ? selected
            ? "border-transparent bg-sidebar-accent text-sidebar-accent-foreground"
            : "border-transparent text-sidebar-foreground/88 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          : selected
            ? "border-border/70 bg-card/75 text-foreground"
            : "border-transparent bg-transparent text-foreground hover:border-border/55 hover:bg-card/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{title}</div>
        {description ? <div className="mt-1 text-xs text-muted-foreground">{description}</div> : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </button>
  );
}
