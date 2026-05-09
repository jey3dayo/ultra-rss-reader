import { LabelChip } from "@/components/shared/label-chip";
import { SectionHeading } from "@/components/shared/section-heading";
import { SurfaceCard } from "@/components/shared/surface-card";
import { cn } from "@/lib/utils";
import { AnnotatedNote, ReferencePage } from "./ui-reference-canvas-specimens";

function ReferenceTypeScaleBlock({
  label,
  hint,
  sampleClassName,
  sampleText,
}: {
  label: string;
  hint: string;
  sampleClassName: string;
  sampleText: string;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-surface-1/88 p-4 shadow-none">
      <div className="mb-3">
        <p className="font-sans text-[11px] font-medium tracking-[0.16em] text-foreground-soft uppercase">{label}</p>
        <p className="mt-1 font-serif text-xs leading-[1.45] text-foreground/72">{hint}</p>
      </div>
      <div className={sampleClassName}>{sampleText}</div>
    </div>
  );
}

function ReferenceSemanticStateCard({
  title,
  description,
  chipLabel,
  chipTone,
  className,
}: {
  title: string;
  description: string;
  chipLabel: string;
  chipTone: "neutral" | "muted" | "success" | "warning" | "danger";
  className?: string;
}) {
  return (
    <SurfaceCard variant="info" tone="subtle" padding="compact" className={cn("shadow-none", className)}>
      <div className="space-y-3">
        <LabelChip tone={chipTone}>{chipLabel}</LabelChip>
        <div>
          <p className="font-sans text-sm text-foreground">{title}</p>
          <p className="mt-1 font-serif text-sm leading-[1.45] text-foreground/68">{description}</p>
        </div>
      </div>
    </SurfaceCard>
  );
}

export function TypographyScaleSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Typography scale</SectionHeading>
      <div className="grid gap-3 lg:grid-cols-2">
        <ReferenceTypeScaleBlock
          label="Display Hero"
          hint="Hero and oversized editorial statements."
          sampleClassName="font-sans text-[3rem] leading-[1.05] tracking-[-0.06em] text-foreground"
          sampleText="Display Hero"
        />
        <ReferenceTypeScaleBlock
          label="Section Heading"
          hint="Top-level section heading with compressed tracking."
          sampleClassName="font-sans text-[2rem] leading-[1.15] tracking-[-0.04em] text-foreground"
          sampleText="Section Heading"
        />
        <ReferenceTypeScaleBlock
          label="Sub-heading"
          hint="Card and sub-section title language."
          sampleClassName="font-sans text-[1.45rem] leading-[1.2] tracking-[-0.03em] text-foreground"
          sampleText="Sub-heading"
        />
        <ReferenceTypeScaleBlock
          label="Body Serif"
          hint="Warm reading copy for explanatory text."
          sampleClassName="font-serif text-[1.08rem] leading-[1.55] text-foreground/84"
          sampleText="Body Serif"
        />
        <ReferenceTypeScaleBlock
          label="Body Sans"
          hint="Neutral UI body text used in controls and status descriptions."
          sampleClassName="font-sans text-base leading-[1.5] text-foreground/78"
          sampleText="Body Sans"
        />
        <ReferenceTypeScaleBlock
          label="Caption"
          hint="Micro labels and metadata."
          sampleClassName="font-sans text-[11px] leading-[1.45] tracking-[0.08em] text-foreground/72 uppercase"
          sampleText="Caption"
        />
        <ReferenceTypeScaleBlock
          label="Mono Small"
          hint="Inline technical text and compact identifiers."
          sampleClassName="font-mono text-[11px] leading-[1.35] tracking-[-0.02em] text-foreground/72"
          sampleText="Mono Small"
        />
      </div>
    </SurfaceCard>
  );
}

export function SemanticStateSurfaceSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Semantic state surfaces</SectionHeading>
      <div data-testid="reference-semantic-state-grid" className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <ReferenceSemanticStateCard
          title="Neutral surface"
          description="Default informational surface with quiet emphasis."
          chipLabel="Neutral"
          chipTone="neutral"
        />
        <ReferenceSemanticStateCard
          title="Success surface"
          description="Positive feedback and keep/safe actions."
          chipLabel="Success"
          chipTone="success"
          className="border-state-success-border bg-state-success-surface text-state-success-foreground"
        />
        <ReferenceSemanticStateCard
          title="Warning surface"
          description="Needs review without implying destructive urgency."
          chipLabel="Warning"
          chipTone="warning"
          className="border-state-warning-border bg-state-warning-surface text-state-warning-foreground"
        />
        <ReferenceSemanticStateCard
          title="Danger surface"
          description="Destructive decisions and irreversible error states."
          chipLabel="Danger"
          chipTone="danger"
          className="border-state-danger-border bg-state-danger-surface text-state-danger-foreground"
        />
        <ReferenceSemanticStateCard
          title="Review accent"
          description="Soft editorial emphasis for flagged-but-not-dangerous states."
          chipLabel="Review"
          chipTone="warning"
          className="border-state-review-border bg-state-review-surface text-state-review-foreground"
        />
        <ReferenceSemanticStateCard
          title="Unread accent"
          description="Reading-context state. Usually tint or light wash, not a solid block."
          chipLabel="Unread"
          chipTone="muted"
          className="border-border/60 bg-[color-mix(in_srgb,var(--tone-unread)_18%,transparent)]"
        />
        <ReferenceSemanticStateCard
          title="Starred accent"
          description="Saved/favorited context. Use as a supporting signal."
          chipLabel="Starred"
          chipTone="muted"
          className="border-border/60 bg-[color-mix(in_srgb,var(--tone-starred)_18%,transparent)]"
        />
        <ReferenceSemanticStateCard
          title="Thinking accent"
          description="AI or background-processing state in special components."
          chipLabel="Thinking accent"
          chipTone="muted"
          className="border-border/60 bg-[color-mix(in_srgb,#dfa88f_18%,transparent)]"
        />
      </div>
    </SurfaceCard>
  );
}

export function SurfaceRoleSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Surface roles</SectionHeading>
      <div className="grid gap-3 sm:grid-cols-2">
        <SurfaceCard variant="info" padding="compact">
          <SectionHeading className="mb-2">Info surface</SectionHeading>
          <p className="font-serif text-sm leading-[1.45] text-foreground/72">
            情報カード用の shared surface。軽い注釈や補足に使う。
          </p>
        </SurfaceCard>
        <SurfaceCard variant="section" padding="compact">
          <SectionHeading className="mb-2">Section surface</SectionHeading>
          <p className="font-serif text-sm leading-[1.45] text-foreground/72">
            SettingsSection と同じ section box 用 surface。構造の区切りとして使う。
          </p>
        </SurfaceCard>
      </div>
    </SurfaceCard>
  );
}

export { AnnotatedNote, ReferencePage };
