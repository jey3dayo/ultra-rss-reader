import type { ReactNode } from "react";
import { SectionHeading } from "@/components/shared/section-heading";

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
      <div className="rounded-[24px] border border-border/60 bg-card/36 px-4 py-4 shadow-elevation-1 sm:px-5 sm:py-5">
        <SectionHeading className={headingClassName}>{heading}</SectionHeading>
        <div className={contentClassName}>{children}</div>
        {note ? <p className="mt-1.5 font-serif text-xs leading-[1.45] text-foreground/56 sm:mt-2">{note}</p> : null}
      </div>
    </section>
  );
}
