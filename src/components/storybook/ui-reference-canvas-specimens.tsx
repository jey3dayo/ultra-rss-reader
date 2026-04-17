import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { AlertTriangle, BookOpen, Check, Clock3, List, Palette, Settings2, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { FolderSectionView } from "@/components/reader/folder-section";
import { AccountsNavView } from "@/components/settings/accounts-nav-view";
import type { AccountNavItem, SettingsNavItem } from "@/components/settings/settings-nav.types";
import { SettingsNavView } from "@/components/settings/settings-nav-view";
import { SettingsSection } from "@/components/settings/settings-section";
import { StarIcon, UnreadIcon } from "@/components/shared/article-state-icon";
import { controlChipIconVariants, controlChipVariants } from "@/components/shared/control-chip";
import { ControlChipButton } from "@/components/shared/control-chip-button";
import { DecisionButton, denseDecisionButtonClassName } from "@/components/shared/decision-button";
import { TAG_COLOR_PRESETS } from "@/components/shared/exception-palettes";
import { FeedDetailPanel } from "@/components/shared/feed-detail-panel";
import { GradientSwitch } from "@/components/shared/gradient-switch";
import { LabelChip } from "@/components/shared/label-chip";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { LabeledInputRow } from "@/components/shared/labeled-input-row";
import { LabeledSelectRow } from "@/components/shared/labeled-select-row";
import { LabeledSwitchRow } from "@/components/shared/labeled-switch-row";
import { SectionHeading } from "@/components/shared/section-heading";
import { SurfaceCard } from "@/components/shared/surface-card";
import { TagColorPicker } from "@/components/shared/tag-color-picker";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AnnotatedNoteProps = {
  title: string;
  body: string;
};

type ReferencePageProps = {
  children: ReactNode;
  maxWidthClassName?: string;
};

type MainContentShellSpecimenProps = {
  title?: string;
  subtitle?: string;
  children?: ReactNode;
};

type FormRowsSpecimenProps = {
  livePreview: boolean;
  onLivePreviewChange: (next: boolean) => void;
};

type ReaderFilterMode = "unread" | "all" | "starred";

const FILTER_ITEMS = [
  { value: "unread", label: "未読", icon: "unread" },
  { value: "all", label: "すべて", icon: "list" },
  { value: "starred", label: "スター", icon: "star" },
] as const;

const REFERENCE_FILTER_TONE_CLASSNAMES = {
  unread:
    "text-sidebar-foreground/90 hover:text-sidebar-foreground data-[pressed]:bg-[color-mix(in_srgb,var(--tone-unread)_var(--tone-surface-strength),transparent)] data-[pressed]:text-[color-mix(in_srgb,var(--tone-unread)_88%,var(--sidebar-selection-foreground))]",
  all: "text-sidebar-foreground/90 hover:text-sidebar-foreground data-[pressed]:bg-sidebar-accent/85 data-[pressed]:text-sidebar-foreground",
  starred:
    "text-sidebar-foreground/90 hover:text-sidebar-foreground data-[pressed]:bg-[color-mix(in_srgb,var(--tone-starred)_var(--tone-surface-strength),transparent)] data-[pressed]:text-[color-mix(in_srgb,var(--tone-starred)_92%,var(--sidebar-selection-foreground))]",
} as const;

const REFERENCE_NAV_ITEMS: SettingsNavItem[] = [
  { id: "general", label: "General", icon: <Settings2 className="h-4 w-4" />, isActive: true },
  { id: "appearance", label: "Appearance", icon: <Palette className="h-4 w-4" />, isActive: false },
  { id: "reading", label: "Reading", icon: <BookOpen className="h-4 w-4" />, isActive: false },
];

const ACCOUNT_CARDS: AccountNavItem[] = [
  { id: "acc-1", name: "Local", kind: "local", isActive: true },
  { id: "acc-2", name: "FreshRSS", kind: "freshrss", isActive: false },
  { id: "acc-3", name: "debug", kind: "freshrss", isActive: false },
];

const NAV_SAMPLE_FOLDER: FolderDto = {
  id: "folder-interior",
  account_id: "acc-1",
  name: "Interior",
  sort_order: 0,
};

const NAV_SAMPLE_FEEDS: FeedDto[] = [
  {
    id: "feed-diy",
    account_id: "acc-1",
    folder_id: "folder-interior",
    title: "99% DIY -DIYブログ-",
    url: "https://example.com/diy.xml",
    site_url: "https://example.com/diy",
    unread_count: 3,
    reader_mode: "on",
    web_preview_mode: "off",
  },
  {
    id: "feed-cafict",
    account_id: "acc-1",
    folder_id: "folder-interior",
    title: "CAFICT",
    url: "https://example.com/cafict.xml",
    site_url: "https://example.com/cafict",
    unread_count: 4,
    reader_mode: "on",
    web_preview_mode: "off",
  },
];

const STACK_SPECIMEN_FRAME_RADIUS_CLASS = "rounded-md";
const SHELL_SPECIMEN_OUTER_RADIUS_CLASS = "rounded-xl";
const SHELL_SPECIMEN_INNER_RADIUS_CLASS = "rounded-lg";

export function ReferencePage({ children, maxWidthClassName = "max-w-6xl" }: ReferencePageProps) {
  return (
    <div className="h-screen overflow-y-auto bg-background px-6 py-8 text-foreground sm:px-8">
      <div className={cn("mx-auto w-full", maxWidthClassName)}>{children}</div>
    </div>
  );
}

export function AnnotatedNote({ title, body }: AnnotatedNoteProps) {
  return (
    <div
      data-testid="reference-annotated-note"
      className="rounded-md border border-border/70 bg-surface-1/85 px-3 py-3 shadow-elevation-1"
    >
      <SectionHeading className="mb-2">{title}</SectionHeading>
      <p className="font-serif text-sm leading-[1.45] text-foreground/72">{body}</p>
    </div>
  );
}

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
    <div className="rounded-md border border-border/70 bg-surface-1/88 px-4 py-4 shadow-none">
      <div className="mb-3">
        <p className="font-sans text-[11px] font-medium tracking-[0.16em] text-foreground-soft uppercase">{label}</p>
        <p className="mt-1 font-serif text-xs leading-[1.45] text-foreground/58">{hint}</p>
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

export function LeftBandShellSpecimen() {
  return (
    <aside
      className={cn(SHELL_SPECIMEN_OUTER_RADIUS_CLASS, "border border-border/60 bg-card/40 p-3 shadow-elevation-1")}
    >
      <AnnotatedNote
        title="Left Band"
        body="Use the existing settings rail as the shell outer frame. Let spacing and tonal shifts do the work before adding stronger accents."
      />
      <div className={cn("mt-3 border border-border/60 bg-sidebar/90", SHELL_SPECIMEN_INNER_RADIUS_CLASS)}>
        <SettingsNavView
          ariaLabel="Reference settings sections"
          items={REFERENCE_NAV_ITEMS}
          onSelectCategory={() => {}}
        />
      </div>
      <div className="mt-3">
        <AnnotatedNote
          title="Warm separation"
          body="Keep the rail visibly present with soft borders, muted cream surfaces, and restrained emphasis for the selected row."
        />
      </div>
    </aside>
  );
}

export function MainContentShellSpecimen({
  title = "Main content shell",
  subtitle = "Keep the main panel as the app-level outer frame. Section containers and helper notes should sit inside it.",
  children,
}: MainContentShellSpecimenProps) {
  return (
    <div className={cn(SHELL_SPECIMEN_OUTER_RADIUS_CLASS, "border border-border/60 bg-card/34 shadow-elevation-2")}>
      <div className="p-4 sm:p-6">
        <div className={cn(SHELL_SPECIMEN_INNER_RADIUS_CLASS, "border border-border/70 bg-background/70 p-4 sm:p-5")}>
          <AnnotatedNote title={title} body={subtitle} />
          {children ? <div className="mt-4">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function ReferenceRadioGroup() {
  const [value, setValue] = useState("comfortable");

  return (
    <LabeledControlRow label="Reading mode" labelId="reference-reading-mode">
      <div className="flex w-full justify-end">
        <div className="w-full sm:max-w-[20rem]">
          <RadioGroup
            aria-labelledby="reference-reading-mode"
            aria-label="Reading mode"
            value={value}
            onValueChange={setValue}
            className="flex flex-wrap justify-end gap-2"
          >
            {[
              { value: "compact", label: "Compact" },
              { value: "comfortable", label: "Comfortable" },
            ].map((option) => {
              const checked = value === option.value;

              return (
                // biome-ignore lint/a11y/noLabelWithoutControl: Base UI Radio renders its own hidden input
                <label
                  key={option.value}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm shadow-elevation-1 transition-colors",
                    checked
                      ? "border-border-strong bg-surface-3 text-foreground"
                      : "border-border bg-surface-1 text-foreground/72 hover:bg-surface-2",
                  )}
                >
                  <Radio.Root
                    value={option.value}
                    aria-label={option.label}
                    className={cn(
                      "flex size-4 items-center justify-center rounded-full border transition-colors",
                      checked ? "border-primary bg-primary/10" : "border-border-strong bg-background",
                    )}
                  >
                    <Radio.Indicator className="size-2 rounded-full bg-primary" />
                  </Radio.Root>
                  <span aria-hidden="true">{option.label}</span>
                </label>
              );
            })}
          </RadioGroup>
        </div>
      </div>
    </LabeledControlRow>
  );
}

export function FormRowsSpecimen({ livePreview, onLivePreviewChange }: FormRowsSpecimenProps) {
  return (
    <SettingsSection
      heading="Form rows"
      note="Input / select / switch は既存の labeled row を再利用し、注釈は短く添える。"
    >
      <LabeledInputRow
        label="Feed URL"
        name="feed_url"
        value="https://example.com/feed.xml"
        onChange={() => {}}
        placeholder="https://example.com/feed.xml"
        controlClassName="flex-col items-stretch sm:flex-row sm:items-center"
        actionLabel="Fetch"
        actionClassName="w-full justify-center sm:w-auto"
        onAction={() => {}}
        actionDisabled={false}
      />
      <LabeledSelectRow
        label="Density"
        name="density"
        value="comfortable"
        options={[
          { value: "compact", label: "Compact" },
          { value: "comfortable", label: "Comfortable" },
          { value: "spacious", label: "Spacious" },
        ]}
        onChange={() => {}}
        triggerClassName="min-w-[11rem]"
      />
      <LabeledSwitchRow label="Live Preview" checked={livePreview} onChange={onLivePreviewChange} />
      <ReferenceRadioGroup />
    </SettingsSection>
  );
}

export function ValidationRowSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Validation row</SectionHeading>
      <div
        data-testid="reference-validation-frame"
        className="rounded-md border border-border/70 bg-surface-1/90 px-3 py-3"
      >
        <LabeledInputRow
          label="Server URL"
          name="invalid_server_url"
          value="freshrss.local"
          onChange={() => {}}
          placeholder="https://your-freshrss.example"
          inputClassName="border-state-danger-border ring-destructive/10"
        />
        <p className="pt-2 pl-[0.02rem] font-serif text-xs leading-[1.45] text-state-danger-foreground">
          URL は `https://` から始めてください。
        </p>
      </div>
    </SurfaceCard>
  );
}

export function DisabledSwitchSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Disabled switch</SectionHeading>
      <div
        data-testid="reference-disabled-switch-frame"
        className="rounded-md border border-border/70 bg-surface-1/90 px-3 py-2"
      >
        <LabeledControlRow label="ミュート時に自動既読">
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-dashed border-border/70 px-2.5 py-1 text-[11px] text-foreground/58">
              工事中
            </span>
            <GradientSwitch checked={false} disabled aria-label="ミュート時に自動既読" />
          </div>
        </LabeledControlRow>
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/58">
        利用予定だが今は無効、という状態の見本。注記と disabled control を同時に見せる。
      </p>
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
          sampleClassName="font-sans text-[11px] leading-[1.45] tracking-[0.08em] text-foreground/58 uppercase"
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
          description="Destructive decisions and broken integrity states."
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

export function ReaderFilterStripSpecimen() {
  const [mode, setMode] = useState<ReaderFilterMode>("unread");

  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Reader filter strip</SectionHeading>
      <div
        data-testid="reference-filter-strip-frame"
        className={cn(
          STACK_SPECIMEN_FRAME_RADIUS_CLASS,
          "border border-sidebar-border/70 bg-sidebar px-3 py-2 text-sidebar-foreground shadow-elevation-1",
        )}
      >
        <ToggleGroup
          aria-label="記事フィルター"
          value={[mode]}
          onValueChange={(values) => {
            const next = values[values.length - 1] as ReaderFilterMode | undefined;
            if (next) {
              setMode(next);
            }
          }}
          className="flex items-center gap-1"
        >
          {FILTER_ITEMS.map((item) => (
            <Toggle
              key={item.value}
              value={item.value}
              aria-label={item.label}
              className={cn(
                controlChipVariants({ size: "filter", interaction: "toggle" }),
                REFERENCE_FILTER_TONE_CLASSNAMES[item.value],
              )}
            >
              {item.icon === "star" ? (
                <StarIcon starred={mode === "starred"} className={controlChipIconVariants({ size: "filter" })} />
              ) : item.icon === "list" ? (
                <List className={controlChipIconVariants({ size: "filter" })} />
              ) : (
                <UnreadIcon unread={mode === "unread"} className="h-2.5 w-2.5" />
              )}
              {item.label}
            </Toggle>
          ))}
        </ToggleGroup>
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/58">
        reader 固有の帯。filter chip 群と補助説明の密度を確認する。
      </p>
    </SurfaceCard>
  );
}

export function WorkspaceFilterClusterSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Workspace filter cluster</SectionHeading>
      <div
        data-testid="reference-workspace-filter-cluster-frame"
        className={cn(
          STACK_SPECIMEN_FRAME_RADIUS_CLASS,
          "border border-border/70 bg-surface-1/88 px-3 py-3 shadow-elevation-1",
        )}
      >
        <div className="flex flex-wrap gap-2">
          {[
            { label: "すべて", count: 163, pressed: true },
            { label: "90日以上更新なし", count: 0, pressed: false },
            { label: "未読なし", count: 163, pressed: false },
            { label: "スターなし", count: 163, pressed: false },
          ].map((item) => (
            <ControlChipButton
              key={item.label}
              pressed={item.pressed}
              size="comfortable"
              className="gap-2 rounded-md px-3.5"
            >
              <span>{item.label}</span>
              <LabelChip tone="muted" size="compact" className="rounded-sm px-1.5">
                {item.count}
              </LabelChip>
            </ControlChipButton>
          ))}
          <ControlChipButton pressed={false} size="comfortable" className="rounded-md px-3.5">
            あとで確認を表示
          </ControlChipButton>
        </div>
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/58">
        密度の高いワークスペースでは、pill よりも少し角張った filter chip
        を優先する。件数バッジはさらに一段小さく角を落として、本文ラベルより控えめに扱う。
      </p>
    </SurfaceCard>
  );
}

export function WorkspaceActionClusterSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Workspace action cluster</SectionHeading>
      <div
        data-testid="reference-workspace-action-cluster"
        className={cn(
          STACK_SPECIMEN_FRAME_RADIUS_CLASS,
          "border border-border/70 bg-surface-1/88 px-3 py-3 shadow-elevation-1",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <DecisionButton intent="keep" className={denseDecisionButtonClassName} aria-label="Keep selected">
            <Check className="h-4 w-4" />
            Keep selected
          </DecisionButton>
          <DecisionButton intent="defer" className={denseDecisionButtonClassName} aria-label="Defer selected">
            <Clock3 className="h-4 w-4" />
            Defer selected
          </DecisionButton>
          <DecisionButton intent="delete" className={denseDecisionButtonClassName} aria-label="Delete selected">
            <Trash2 className="h-4 w-4" />
            Delete selected
          </DecisionButton>
        </div>
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/58">
        dense toolbar では action width を揃え、keep / defer / delete の順で置く。destructive
        は最後に寄せ、視線の終点に置く。
      </p>
    </SurfaceCard>
  );
}

export function DetailPanelSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Detail panel</SectionHeading>
      <div data-testid="reference-detail-panel-frame" className="max-w-[34rem]">
        <FeedDetailPanel
          title="AUTOMATON"
          titleHref="https://automaton-media.com"
          badgeLabel="Review"
          badgeTone="medium"
          reasonBox={{
            title: "整理候補になった理由",
            body: "未読 0件 / スター 0件",
            tone: "medium",
          }}
          metrics={[
            { label: "フォルダ", value: "Gaming" },
            { label: "最終記事", value: "2026/04/16" },
            { label: "未読", value: 0 },
            { label: "スター", value: 0 },
          ]}
          links={[]}
          recentArticlesHeading="最近の記事"
          recentArticles={[
            {
              id: "ref-1",
              title: "SIE新作高難度3D弾幕ローグライトシューター『SAROS』開発者インタビュー。",
              publishedAt: "2026/04/16",
              url: "https://example.com/article",
            },
          ]}
          primaryAction={{ label: "フィードを編集", onClick: () => {}, ariaLabel: "フィードを編集" }}
          reasonChips={["一度見ておきたい購読"]}
        />
      </div>
    </SurfaceCard>
  );
}

export function WorkspaceTwoPaneSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Workspace two-pane</SectionHeading>
      <div
        data-testid="reference-workspace-two-pane-frame"
        className="grid gap-4 rounded-md border border-border/70 bg-card/30 p-3 shadow-none lg:grid-cols-[minmax(0,1fr)_480px]"
      >
        <div className="space-y-3">
          <div className="rounded-md border border-border/70 bg-surface-1/88 px-3 py-3 shadow-none">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-border/70 bg-background/90 px-3 py-3">
                <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">要確認</p>
                <p className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-foreground">6</p>
              </div>
              <div className="rounded-md border border-border/70 bg-background/90 px-3 py-3">
                <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">参照エラー</p>
                <p className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-foreground">1</p>
              </div>
            </div>
          </div>
          <div className="rounded-md border border-border/70 bg-surface-1/84 px-3 py-3 shadow-none">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="font-sans text-sm font-medium text-foreground">Queue</h4>
              <LabelChip tone="neutral" size="compact">
                3
              </LabelChip>
            </div>
            <div className="space-y-2">
              {["AUTOMATON", "Publickey", "NHKニュース"].map((title) => (
                <div key={title} className="rounded-md border border-border/70 bg-background/86 px-3 py-3">
                  <p className="font-sans text-sm text-foreground">{title}</p>
                  <p className="mt-1 font-serif text-xs leading-[1.45] text-foreground/58">
                    選択中の feed に応じて detail pane を更新する二段構成。
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-md border border-border/70 bg-surface-1/84 px-3 py-3 shadow-none">
          <FeedDetailPanel
            title="AUTOMATON"
            titleHref="https://automaton-media.com"
            badgeLabel="Review"
            badgeTone="medium"
            reasonBox={{
              title: "整理候補になった理由",
              body: "未読 0件 / スター 0件",
              tone: "medium",
            }}
            metrics={[
              { label: "フォルダ", value: "Gaming" },
              { label: "最終記事", value: "2026/04/16" },
              { label: "未読", value: 0 },
              { label: "スター", value: 0 },
            ]}
            links={[]}
            recentArticlesHeading="最近の記事"
            recentArticles={[
              {
                id: "ref-2",
                title: "SIE新作高難度3D弾幕ローグライトシューター『SAROS』開発者インタビュー。",
                publishedAt: "2026/04/16",
                url: "https://example.com/article",
              },
            ]}
            primaryAction={{ label: "フィードを編集", onClick: () => {}, ariaLabel: "フィードを編集" }}
            reasonChips={["一度見ておきたい購読"]}
          />
        </div>
      </div>
    </SurfaceCard>
  );
}

export function AccountCardStackSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Account card stack</SectionHeading>
      <div
        data-testid="reference-account-card-frame"
        className={cn(
          STACK_SPECIMEN_FRAME_RADIUS_CLASS,
          "max-w-[18rem] border border-sidebar-border/70 bg-sidebar px-2 py-2 text-sidebar-foreground shadow-elevation-1",
        )}
      >
        <AccountsNavView
          accounts={ACCOUNT_CARDS}
          addAccountLabel="アカウントを追加..."
          isAddAccountActive={false}
          onSelectAccount={() => {}}
          onAddAccount={() => {}}
        />
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/58">
        avatar とタイトル、補足行をまとめて見せたいときの密度見本。settings の account list に近い。
      </p>
    </SurfaceCard>
  );
}

export function AnnouncementCardsSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Announcement cards</SectionHeading>
      <div className="flex flex-wrap items-center gap-4">
        <div
          data-testid="reference-announcement-card-pending"
          className={cn(
            STACK_SPECIMEN_FRAME_RADIUS_CLASS,
            "flex items-center gap-4 border border-border/60 bg-card/52 px-4 py-3 shadow-elevation-1",
          )}
        >
          <span className="inline-flex min-w-12 justify-center rounded-md border border-border/70 bg-background px-3 py-2 font-sans text-2xl font-medium text-foreground">
            163
          </span>
          <div>
            <p className="font-sans text-base text-foreground">確認待ち</p>
            <p className="font-serif text-sm text-muted-foreground">これから判断する購読</p>
          </div>
        </div>
        <div
          data-testid="reference-announcement-card-decided"
          className={cn(
            STACK_SPECIMEN_FRAME_RADIUS_CLASS,
            "flex items-center gap-4 border border-state-success-border bg-state-success-surface px-4 py-3 shadow-elevation-1",
          )}
        >
          <span className="inline-flex min-w-12 justify-center rounded-md border border-state-success-border bg-state-success-surface px-3 py-2 font-sans text-2xl font-medium text-state-success-foreground">
            0
          </span>
          <div>
            <p className="font-sans text-base text-foreground">判断済み</p>
            <p className="font-serif text-sm text-muted-foreground">すでに対応した購読</p>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}

export function NavigationStackSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Folder stack</SectionHeading>
      <div
        data-testid="reference-folder-stack-frame"
        className={cn(
          STACK_SPECIMEN_FRAME_RADIUS_CLASS,
          "max-w-[18rem] border border-sidebar-border/70 bg-sidebar px-2 py-2 text-sidebar-foreground shadow-elevation-1",
        )}
      >
        <FolderSectionView
          folder={NAV_SAMPLE_FOLDER}
          feeds={NAV_SAMPLE_FEEDS}
          isExpanded={true}
          onToggle={() => {}}
          selectedFeedId={null}
          onSelectFeed={() => {}}
          displayFavicons={true}
        />
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/58">
        folder trigger と feed row の組み合わせ見本。数値列と favicon の密度を見るための断片。
      </p>
    </SurfaceCard>
  );
}

export function TagPaletteSpecimen() {
  const [color, setColor] = useState<string | null>(TAG_COLOR_PRESETS[3]);

  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Tag palette</SectionHeading>
      <TagColorPicker
        label="カラー"
        color={color}
        colorOptions={TAG_COLOR_PRESETS}
        noColorLabel="色なし"
        optionAriaLabel={(option) => `カラー ${option}`}
        onChange={setColor}
      />
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/58">
        サイドバーや記事画面で使うタグ色の選択見本。色 chip 群と説明文の関係を見るための断片。
      </p>
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

export function ShellExamplesSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Shell examples</SectionHeading>
      <div className="grid gap-3 xl:grid-cols-2">
        <div
          className={cn(
            SHELL_SPECIMEN_OUTER_RADIUS_CLASS,
            "border border-border/60 bg-card/36 px-4 py-4 shadow-elevation-1 sm:px-5 sm:py-5",
          )}
        >
          <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-foreground/58">Dialog shell</div>
          <p className="mb-3 font-serif text-xs leading-[1.45] text-foreground/58">
            Outer shell only. Keep the inner dialog component surface separate and smaller-radius.
          </p>
          <div className={cn(SHELL_SPECIMEN_INNER_RADIUS_CLASS, "border border-border/70 bg-background/70 p-4")}>
            <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-foreground/58">Dialog shell frame</div>
            <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-foreground/58">
              Inner dialog component surface
            </div>
            <div className="mx-auto grid w-full max-w-[300px] gap-4 rounded-lg border border-border bg-surface-2 p-5 text-sm text-popover-foreground shadow-elevation-3">
              <div className="flex flex-col items-center gap-4 py-2 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15">
                  <AlertTriangle className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm text-foreground">この購読を削除しますか？</p>
                <div className="flex w-full flex-col gap-2">
                  <Button className="min-h-11 w-full">削除する</Button>
                  <Button variant="ghost" className="min-h-11 w-full text-muted-foreground">
                    キャンセル
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          className={cn(
            SHELL_SPECIMEN_OUTER_RADIUS_CLASS,
            "border border-border/60 bg-card/36 px-4 py-4 shadow-elevation-1 sm:px-5 sm:py-5",
          )}
        >
          <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-foreground/58">Context menu shell</div>
          <p className="mb-3 font-serif text-xs leading-[1.45] text-foreground/58">
            This is the workspace frame around the menu body, not the reusable menu body itself.
          </p>
          <div className={cn(SHELL_SPECIMEN_INNER_RADIUS_CLASS, "border border-border/70 bg-background/70 p-4")}>
            <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-foreground/58">
              Context menu shell frame
            </div>
            <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-foreground/58">Inner menu body</div>
            <div className="inline-flex rounded-md border border-border px-3 py-2 text-sm text-foreground">Feed</div>
            <div className="mt-3 min-w-[200px] rounded-lg border border-border bg-popover p-1 text-sm text-popover-foreground shadow-lg outline-none">
              <div className="flex w-full items-center rounded-md px-3 py-1.5">Edit…</div>
              <div className="flex w-full items-center rounded-md px-3 py-1.5">Open site</div>
              <div className="flex w-full items-center rounded-md px-3 py-1.5">Mark all as read</div>
              <div className="my-1 h-px bg-border" />
              <div className="px-3 py-1 text-xs font-medium text-muted-foreground">Display mode</div>
              <div className="flex w-full items-center rounded-md px-3 py-1.5">Default</div>
              <div className="flex w-full items-center rounded-md px-3 py-1.5">Standard</div>
              <div className="flex w-full items-center rounded-md px-3 py-1.5">
                <span className="mr-2 inline-flex w-4 justify-center">✓</span>
                Preview
              </div>
              <div className="my-1 h-px bg-border" />
              <div className="flex w-full items-center rounded-md px-3 py-1.5">Unsubscribe…</div>
            </div>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
