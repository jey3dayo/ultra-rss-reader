import type { ReactNode } from "react";
import { SectionHeading } from "@/components/shared/section-heading";
import { cn } from "@/lib/utils";

type AnnotatedNoteProps = {
  title: string;
  body: string;
};

type ReferencePageProps = {
  children: ReactNode;
  maxWidthClassName?: string;
};

export function ReferencePage({ children, maxWidthClassName = "max-w-6xl" }: ReferencePageProps) {
  return (
    <div className="min-h-screen bg-background px-6 py-8 text-foreground sm:px-8">
      <div className={cn("mx-auto w-full", maxWidthClassName)}>{children}</div>
    </div>
  );
}

export function AnnotatedNote({ title, body }: AnnotatedNoteProps) {
  return (
    <div
      data-testid="reference-annotated-note"
      className="rounded-md border border-border/70 bg-surface-1/85 p-3 shadow-elevation-1"
    >
      <SectionHeading className="mb-2">{title}</SectionHeading>
      <p className="font-serif text-sm leading-[1.45] text-foreground/72">{body}</p>
    </div>
  );
}
