import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SettingsShellSectionLabelProps = {
  children: ReactNode;
  className?: string;
};

export function SettingsShellSectionLabel({ children, className }: SettingsShellSectionLabelProps) {
  return (
    <p
      className={cn(
        "mb-2 select-none px-1 font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-[color:var(--settings-shell-section-label)]",
        className,
      )}
    >
      {children}
    </p>
  );
}
