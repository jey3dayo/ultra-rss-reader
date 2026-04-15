import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AlertTriangle, BookOpen, GripVertical, List, Palette, Settings2, WandSparkles } from "lucide-react";
import { useState } from "react";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { FolderSectionView } from "@/components/reader/folder-section";
import { AccountsNavView } from "@/components/settings/accounts-nav-view";
import { SettingsContentLayout } from "@/components/settings/settings-content-layout";
import type { AccountNavItem, SettingsNavItem } from "@/components/settings/settings-nav.types";
import { SettingsNavView } from "@/components/settings/settings-nav-view";
import { SettingsSection } from "@/components/settings/settings-section";
import { StarIcon, UnreadIcon } from "@/components/shared/article-state-icon";
import { controlChipIconVariants, controlChipVariants } from "@/components/shared/control-chip";
import { GradientSwitch } from "@/components/shared/gradient-switch";
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

function AnnotatedNote({ title, body }: AnnotatedNoteProps) {
  return (
    <div className="rounded-2xl border border-border/70 bg-surface-1/85 px-3 py-3 shadow-elevation-1">
      <SectionHeading className="mb-2">{title}</SectionHeading>
      <p className="font-serif text-sm leading-[1.45] text-foreground/72">{body}</p>
    </div>
  );
}

function ReferenceRadioGroup() {
  const [value, setValue] = useState("comfortable");

  return (
    <LabeledControlRow label="Reading mode" labelId="reference-reading-mode">
      <div className="w-full sm:max-w-[20rem]">
        <RadioGroup
          aria-labelledby="reference-reading-mode"
          aria-label="Reading mode"
          value={value}
          onValueChange={setValue}
          className="flex flex-wrap gap-2"
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
                  "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm shadow-elevation-1 transition-colors",
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
    </LabeledControlRow>
  );
}

function ReferenceDragPattern() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Drag handle pattern</SectionHeading>
      <div className="rounded-2xl border border-border/70 bg-surface-1/90 px-3 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Reorder Reading layout"
            className="inline-flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-full border border-border bg-background text-foreground-soft shadow-elevation-1 transition-colors hover:bg-surface-2 hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="font-sans text-sm text-foreground">Reading layout</div>
            <div className="font-serif text-xs leading-[1.45] text-foreground/58">
              Drag this row to reorder priority
            </div>
          </div>
          <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-foreground-soft">
            Handle
          </span>
        </div>
      </div>
    </SurfaceCard>
  );
}

type ReaderFilterMode = "unread" | "all" | "starred";

const FILTER_ITEMS = [
  { value: "unread", label: "未読", icon: "unread" },
  { value: "all", label: "すべて", icon: "list" },
  { value: "starred", label: "スター", icon: "star" },
] as const;

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

const TAG_COLOR_PRESETS = [
  "#cf7868",
  "#c88d62",
  "#b59a64",
  "#5f9670",
  "#5f9695",
  "#6f8eb8",
  "#8c79b2",
  "#b97a90",
  "#726d66",
] as const;

function ReaderFilterStripSpecimen() {
  const [mode, setMode] = useState<ReaderFilterMode>("unread");

  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Reader filter strip</SectionHeading>
      <div className="rounded-[20px] border border-sidebar-border/70 bg-sidebar px-3 py-2 text-sidebar-foreground shadow-elevation-1">
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
                controlChipVariants({ size: "comfortable", interaction: "toggle" }),
                "rounded-full px-3 text-sidebar-foreground/78 hover:text-sidebar-foreground data-[pressed]:bg-sidebar-accent/85 data-[pressed]:text-sidebar-foreground",
              )}
            >
              {item.icon === "star" ? (
                <StarIcon starred={mode === "starred"} className={controlChipIconVariants({ size: "comfortable" })} />
              ) : item.icon === "list" ? (
                <List className={controlChipIconVariants({ size: "comfortable" })} />
              ) : (
                <UnreadIcon unread={mode === "unread"} className="h-3.5 w-3.5" />
              )}
              {item.label}
            </Toggle>
          ))}
        </ToggleGroup>
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/58">
        reader 固有の帯なので別ページ化もできるが、今は「よく使う見本を一枚に集約する」方を優先する。
      </p>
    </SurfaceCard>
  );
}

function AccountCardStackSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Account card stack</SectionHeading>
      <div className="max-w-[18rem] rounded-[22px] border border-sidebar-border/70 bg-sidebar px-2 py-2 text-sidebar-foreground shadow-elevation-1">
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

function AnnouncementCardsSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Announcement cards</SectionHeading>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-4 rounded-[24px] border border-border/60 bg-card/52 px-4 py-3 shadow-elevation-1">
          <span className="inline-flex min-w-12 justify-center rounded-lg border border-border/70 bg-background px-3 py-2 font-sans text-2xl font-medium text-foreground">
            163
          </span>
          <div>
            <p className="font-sans text-base text-foreground">確認待ち</p>
            <p className="font-serif text-sm text-muted-foreground">これから判断する購読</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-[24px] border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 shadow-elevation-1">
          <span className="inline-flex min-w-12 justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 font-sans text-2xl font-medium text-emerald-700 dark:text-emerald-300">
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

function NavigationStackSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Folder stack</SectionHeading>
      <div className="max-w-[18rem] rounded-[22px] border border-sidebar-border/70 bg-sidebar px-2 py-2 text-sidebar-foreground shadow-elevation-1">
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

function TagPaletteSpecimen() {
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

function DisabledSwitchSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Disabled switch</SectionHeading>
      <div className="rounded-2xl border border-border/70 bg-surface-1/90 px-3 py-2">
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

function ValidationRowSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Validation row</SectionHeading>
      <div className="rounded-2xl border border-border/70 bg-surface-1/90 px-3 py-3">
        <LabeledInputRow
          label="Server URL"
          name="invalid_server_url"
          value="freshrss.local"
          onChange={() => {}}
          placeholder="https://your-freshrss.example"
          inputClassName="border-destructive/40 ring-destructive/10"
        />
        <p className="pt-2 pl-[0.02rem] font-serif text-xs leading-[1.45] text-destructive">
          URL は `https://` から始めてください。
        </p>
      </div>
    </SurfaceCard>
  );
}

function SurfaceRoleSpecimen() {
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

function DialogSpecimen() {
  return (
    <div className="rounded-[24px] border border-border/60 bg-card/36 px-4 py-4 shadow-elevation-1 sm:px-5 sm:py-5">
      <SectionHeading className="mb-2">Dialog surface</SectionHeading>
      <div className="rounded-[26px] border border-border/70 bg-background/70 p-4">
        <div className="mx-auto grid w-full max-w-[300px] gap-4 rounded-xl border border-border bg-surface-2 p-5 text-sm text-popover-foreground shadow-elevation-3">
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
  );
}

function MenuSpecimen() {
  return (
    <div className="rounded-[24px] border border-border/60 bg-card/36 px-4 py-4 shadow-elevation-1 sm:px-5 sm:py-5">
      <SectionHeading className="mb-2">Context menu</SectionHeading>
      <div className="rounded-[22px] border border-border/70 bg-background/70 p-4">
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
  );
}

export function AnnotatedSettingsCanvas() {
  const [livePreview, setLivePreview] = useState(true);
  const navItems: SettingsNavItem[] = [
    { id: "general", label: "General", icon: <Settings2 className="h-4 w-4" />, isActive: true },
    { id: "appearance", label: "Appearance", icon: <Palette className="h-4 w-4" />, isActive: false },
    { id: "reading", label: "Reading", icon: <BookOpen className="h-4 w-4" />, isActive: false },
  ];

  return (
    <div className="min-h-screen bg-background px-6 py-8 text-foreground sm:px-8">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="order-2 rounded-[28px] border border-border/60 bg-card/40 p-3 shadow-elevation-1 lg:order-1">
          <AnnotatedNote
            title="Left Band"
            body="Use the existing settings rail as the skeleton. Let spacing and tonal shifts do the work before adding stronger accents."
          />
          <div className="mt-3 rounded-[24px] border border-border/60 bg-sidebar/90">
            <SettingsNavView ariaLabel="Reference settings sections" items={navItems} onSelectCategory={() => {}} />
          </div>
          <div className="mt-3">
            <AnnotatedNote
              title="Warm separation"
              body="Keep the rail visibly present with soft borders, muted cream surfaces, and restrained emphasis for the selected row."
            />
          </div>
        </aside>

        <div className="order-1 rounded-[32px] border border-border/60 bg-card/34 shadow-elevation-2 lg:order-2">
          <SettingsContentLayout
            title="Annotated controls"
            subtitle="DESIGN.md の warm editorial を土台に、既存 UI コンポーネントだけで一枚の実装カンペを組む。"
            titleLayout="stacked-left"
            maxWidthClassName="max-w-none"
          >
            <div className="mb-4 max-w-3xl">
              <AnnotatedNote
                title="Instructions"
                body="Use this reference canvas as the default starting point when implementing new screens. Prefer composing from these existing specimens and shared components before introducing new visual patterns."
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_15rem]">
              <div className="space-y-4">
                <SurfaceRoleSpecimen />
                <ValidationRowSpecimen />
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
                  <LabeledSwitchRow label="Live Preview" checked={livePreview} onChange={setLivePreview} />
                  <ReferenceRadioGroup />
                </SettingsSection>

                <DisabledSwitchSpecimen />
                <ReferenceDragPattern />
                <ReaderFilterStripSpecimen />
                <AccountCardStackSpecimen />
                <NavigationStackSpecimen />
              </div>

              <div className="space-y-3">
                <AnnouncementCardsSpecimen />
                <TagPaletteSpecimen />
                <DialogSpecimen />
                <MenuSpecimen />
                <AnnotatedNote
                  title="Reader density"
                  body="Radio chips are a specimen for compact mode choices. They do not introduce a new design language outside the existing warm token set."
                />
                <div className="rounded-2xl border border-border/70 bg-surface-1/85 p-3 shadow-elevation-1">
                  <SectionHeading className="mb-2">Action accent</SectionHeading>
                  <p className="mb-3 font-serif text-sm leading-[1.45] text-foreground/72">
                    Keep actions calm and editorial. Stronger emphasis should come from spacing and typography first.
                  </p>
                  <Button type="button" variant="outline" className="w-full justify-center">
                    <WandSparkles className="h-4 w-4" aria-hidden="true" />
                    Generate layout idea
                  </Button>
                </div>
              </div>
            </div>
          </SettingsContentLayout>
        </div>
      </div>
    </div>
  );
}

const meta = {
  title: "UI Reference/Annotated Settings Canvas",
  component: AnnotatedSettingsCanvas,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof AnnotatedSettingsCanvas>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
