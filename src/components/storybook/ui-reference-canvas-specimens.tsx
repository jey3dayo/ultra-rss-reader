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

export const UI_REFERENCE_PRIMARY_SPECIMEN_ANCHOR_IDS = [
  "reference-button-family-guide",
  "reference-button-variant-matrix",
  "reference-button-size-matrix",
  "reference-settings-action-button-matrix",
  "reference-form-loading-actions",
  "reference-semantic-action-buttons",
  "reference-article-filter-toggle-buttons",
  "reference-reader-header-action-strip",
  "reference-reader-header-action-strip-dark",
  "reference-icon-utility-buttons",
  "reference-navigation-button-patterns",
  "reference-specialized-button-patterns",
  "reference-validation-frame",
  "reference-disabled-switch-frame",
  "reference-primitive-control-matrix",
  "reference-update-toast-stability",
  "reference-update-toast-download-0",
  "reference-update-toast-download-90",
  "reference-update-toast-ready",
  "reference-update-toast-failure",
  "reference-utility-action-chrome-strip",
  "reference-command-palette-shell",
  "reference-semantic-state-grid",
  "reference-filter-strip-frame",
  "reference-account-article-nav-alignment",
  "reference-account-card-frame",
  "reference-folder-stack-frame",
  "reference-primitive-collection-states",
  "reference-workspace-filter-cluster-frame",
  "reference-motion-number-frame",
  "reference-summary-filter-card-frame",
  "reference-subscription-group-disclosure-frame",
  "reference-workspace-action-cluster",
  "reference-detail-panel-frame",
  "reference-workspace-two-pane-frame",
  "reference-workspace-two-pane-detail",
  "reference-announcement-card-pending",
  "reference-announcement-card-decided",
  "reference-settings-header-summary-frame",
  "reference-settings-workspace-detail-shell",
  "reference-settings-workspace-add-shell",
] as const;

export const UI_REFERENCE_DECORATIVE_TEST_IDS = [
  "reference-annotated-note",
  "reference-browser-chrome-buttons",
] as const;

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
