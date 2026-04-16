import type { ReactNode } from "react";
import { SectionHeading } from "@/components/shared/section-heading";
import { SurfaceCard } from "@/components/shared/surface-card";

type SettingsSectionProps = {
  heading: string;
  children: ReactNode;
  note?: string;
  className?: string;
  headingClassName?: string;
  contentClassName?: string;
};

export function SettingsSection({
  heading,
  children,
  note,
  className,
  headingClassName,
  contentClassName,
}: SettingsSectionProps) {
  return (
    <section className={className}>
      <SurfaceCard variant="section">
        <SectionHeading className={headingClassName}>{heading}</SectionHeading>
        <div className={contentClassName}>{children}</div>
        {note ? <p className="mt-1.5 font-serif text-xs leading-[1.45] text-foreground-soft sm:mt-2">{note}</p> : null}
      </SurfaceCard>
    </section>
  );
}
