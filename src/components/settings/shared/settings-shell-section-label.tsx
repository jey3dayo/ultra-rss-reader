import type { SectionHeadingProps } from "@/design-system";
import { cn } from "@/lib/utils";

type SettingsShellSectionLabelProps = SectionHeadingProps;

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
