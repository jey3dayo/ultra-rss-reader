import type { ReactNode } from "react";
import { SectionHeading, SurfaceCard } from "@/design-system";
import { cn } from "@/lib/utils";

type SettingsSectionProps = {
  heading: string;
  children: ReactNode;
  note?: string;
  surface?: "card" | "flat";
  className?: string;
  headingClassName?: string;
  contentClassName?: string;
};

export function SettingsSection({
  heading,
  children,
  note,
  surface = "card",
  className,
  headingClassName,
  contentClassName,
}: SettingsSectionProps) {
  const noteClassName = "mt-1.5 font-sans text-[13px] leading-[1.5] text-foreground-soft sm:mt-2";

  if (surface === "flat") {
    return (
      <section
        className={cn(
          "rounded-lg border border-border/55 bg-[color-mix(in_srgb,var(--color-surface-1)_62%,transparent)] px-4 py-3.5 shadow-[0_14px_34px_-30px_rgba(38,37,30,0.32)] backdrop-blur-sm sm:px-5 sm:py-4",
          className,
        )}
      >
        <SectionHeading className={cn("mb-2.5 sm:mb-3", headingClassName)}>{heading}</SectionHeading>
        <div className={cn("[&>*:first-child]:pt-0 [&>*:last-child]:pb-0", contentClassName)}>{children}</div>
        {note ? <p className={noteClassName}>{note}</p> : null}
      </section>
    );
  }

  return (
    <section className={className}>
      <SurfaceCard
        variant="section"
        className="rounded-lg border-border/55 bg-[color-mix(in_srgb,var(--color-surface-1)_62%,transparent)] shadow-[0_14px_34px_-30px_rgba(38,37,30,0.32)]"
      >
        <SectionHeading className={cn("mb-2.5 sm:mb-3", headingClassName)}>{heading}</SectionHeading>
        <div className={contentClassName}>{children}</div>
        {note ? <p className={noteClassName}>{note}</p> : null}
      </SurfaceCard>
    </section>
  );
}
