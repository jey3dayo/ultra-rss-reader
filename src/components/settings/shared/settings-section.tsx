import type { ReactNode } from "react";
import { PHRASE_AWARE_TEXT_CLASS_NAME } from "@/constants";
import { SectionHeading, SurfaceCard } from "@/design-system";
import { cn } from "@/lib/utils";
import { SETTINGS_SECTION_BORDER_CLASS } from "./settings-surface";

type SettingsSectionProps = {
  heading: string;
  children: ReactNode;
  note?: string;
  surface?: "card" | "flat";
  motionPhase?: "entering";
  className?: string;
  headingClassName?: string;
  noteClassName?: string;
  contentClassName?: string;
};

export function SettingsSection({
  heading,
  children,
  note,
  surface = "card",
  motionPhase,
  className,
  headingClassName,
  noteClassName,
  contentClassName,
}: SettingsSectionProps) {
  const defaultNoteClassName = cn(
    "mt-1.5 font-sans text-[13px] leading-[1.5] text-foreground-soft sm:mt-2",
    PHRASE_AWARE_TEXT_CLASS_NAME,
  );

  if (surface === "flat") {
    return (
      <section
        data-motion-phase={motionPhase}
        className={cn(
          "rounded-md border bg-[color-mix(in_srgb,var(--color-surface-1)_62%,transparent)] px-4 py-3.5 shadow-[var(--settings-shell-section-shadow)] backdrop-blur-sm sm:px-5 sm:py-4",
          SETTINGS_SECTION_BORDER_CLASS,
          className,
        )}
      >
        <SectionHeading className={cn("mb-2.5 sm:mb-3", headingClassName)}>{heading}</SectionHeading>
        <div className={cn("[&>*:first-child]:pt-0 [&>*:last-child]:pb-0", contentClassName)}>{children}</div>
        {note ? <p className={cn(defaultNoteClassName, noteClassName)}>{note}</p> : null}
      </section>
    );
  }

  return (
    <section data-motion-phase={motionPhase} className={className}>
      <SurfaceCard
        variant="section"
        className={cn(
          "rounded-md bg-[color-mix(in_srgb,var(--color-surface-1)_62%,transparent)] shadow-[var(--settings-shell-section-shadow)]",
          SETTINGS_SECTION_BORDER_CLASS,
        )}
      >
        <SectionHeading className={cn("mb-2.5 sm:mb-3", headingClassName)}>{heading}</SectionHeading>
        <div className={contentClassName}>{children}</div>
        {note ? <p className={cn(defaultNoteClassName, noteClassName)}>{note}</p> : null}
      </SurfaceCard>
    </section>
  );
}
