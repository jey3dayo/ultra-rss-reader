import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { ComponentProps, ReactNode } from "react";
import { AppTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const sidebarFooterActionButtonClassName = cn(
  "motion-interactive-surface inline-flex h-8 shrink-0 items-center justify-center rounded-md border-0 bg-transparent text-[var(--sidebar-foreground-muted-strong)] shadow-none outline-none select-none transition-none",
  "hover:bg-[var(--sidebar-hover-surface)] hover:text-[var(--sidebar-selection-foreground)]",
  "focus-visible:border-[var(--sidebar-divider-strong)] focus-visible:bg-[var(--sidebar-hover-surface)] focus-visible:ring-0",
  "active:translate-y-0 disabled:pointer-events-none disabled:opacity-100 disabled:text-[var(--sidebar-foreground-muted-strong)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
);

type SidebarFooterActionButtonProps = Omit<ComponentProps<typeof ButtonPrimitive>, "children"> & {
  label: string;
  tooltipLabel?: string;
  children: ReactNode;
};

export function SidebarFooterActionButton({
  label,
  tooltipLabel,
  className,
  children,
  type = "button",
  ...props
}: SidebarFooterActionButtonProps) {
  return (
    <AppTooltip label={tooltipLabel ?? label}>
      <ButtonPrimitive
        {...props}
        type={type}
        aria-label={label}
        className={cn(sidebarFooterActionButtonClassName, className)}
      >
        {children}
      </ButtonPrimitive>
    </AppTooltip>
  );
}
