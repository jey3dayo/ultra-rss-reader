import { List, Settings2 } from "lucide-react";
import { useState } from "react";
import { FeedDtoListSchema, FolderDtoSchema } from "@/api/schemas";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { FolderSectionView } from "@/components/reader/folder-section";
import { SidebarFooterActions } from "@/components/reader/sidebar-footer-actions";
import { SidebarNavButton } from "@/components/reader/sidebar-nav-button";
import { SmartViewsView } from "@/components/reader/smart-views-view";
import { type AccountNavItem, AccountsNavView } from "@/components/settings/accounts-nav-view";
import type { ArticleFilterToggleMode } from "@/design-system";
import {
  AppTooltip,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  controlChipIconVariants,
  controlChipVariants,
  NavRowButton,
  ScrollArea,
  SectionHeading,
  Skeleton,
  StarIcon,
  SurfaceCard,
  TAG_COLOR_PRESETS,
  TagColorPicker,
  TooltipProvider,
  UnreadIcon,
} from "@/design-system";
import { cn } from "@/lib/utils";
import { AnnotatedNote, ReferencePage } from "./ui-reference-canvas-specimens";

export { AnnotatedNote, ReferencePage };

const FILTER_ITEMS = [
  { value: "unread", label: "未読", icon: "unread" },
  { value: "all", label: "すべて", icon: "list" },
  { value: "starred", label: "スター", icon: "star" },
] as const;

const REFERENCE_FILTER_TONE_CLASSNAMES = {
  unread:
    "text-sidebar-foreground/90 hover:text-sidebar-foreground data-[pressed]:bg-[color-mix(in_srgb,var(--tone-unread)_var(--tone-surface-strength),transparent)] data-[pressed]:text-[var(--semantic-tone-unread-sidebar-foreground)]",
  all: "text-sidebar-foreground/90 hover:text-sidebar-foreground data-[pressed]:bg-[var(--sidebar-pressed-surface)] data-[pressed]:text-sidebar-foreground",
  starred:
    "text-sidebar-foreground/90 hover:text-sidebar-foreground data-[pressed]:bg-[color-mix(in_srgb,var(--tone-starred)_var(--tone-surface-strength),transparent)] data-[pressed]:text-[color-mix(in_srgb,var(--tone-starred)_92%,var(--sidebar-selection-foreground))]",
} as const;

const ACCOUNT_CARDS: AccountNavItem[] = [
  {
    id: "acc-1",
    name: "FreshRSS",
    kind: "freshrss",
    username: "jey3dayo",
    isActive: true,
  },
  {
    id: "acc-2",
    name: "debug",
    kind: "freshrss",
    username: "debug",
    serverUrl: "https://jey3dayo.asuscomm.com:5556/api/greader.php",
    isActive: false,
  },
  { id: "acc-3", name: "Local", kind: "local", isActive: false },
];

const NAV_SAMPLE_FOLDER: FolderDto = FolderDtoSchema.parse({
  id: "folder-interior",
  account_id: "acc-1",
  name: "Interior",
  sort_order: 0,
});

const NAV_SAMPLE_FEEDS: FeedDto[] = FeedDtoListSchema.parse([
  {
    id: "feed-diy",
    account_id: "acc-1",
    folder_id: "folder-interior",
    remote_id: null,
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
    remote_id: null,
    title: "CAFICT",
    url: "https://example.com/cafict.xml",
    site_url: "https://example.com/cafict",
    unread_count: 4,
    reader_mode: "on",
    web_preview_mode: "off",
  },
]);

const STACK_SPECIMEN_FRAME_RADIUS_CLASS = "rounded-md";

export function ReaderFilterStripSpecimen() {
  const [mode, setMode] = useState<ArticleFilterToggleMode>("unread");

  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Reader filter strip</SectionHeading>
      <div
        data-testid="reference-filter-strip-frame"
        className={cn(
          STACK_SPECIMEN_FRAME_RADIUS_CLASS,
          "border border-[var(--sidebar-frame-border)] bg-[var(--sidebar-frame-solid-surface)] px-3 py-2 text-sidebar-foreground shadow-elevation-1",
        )}
      >
        <fieldset className="flex items-center gap-1">
          <legend className="sr-only">記事フィルター</legend>
          {FILTER_ITEMS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-label={item.label}
              aria-pressed={mode === item.value}
              data-pressed={mode === item.value ? "" : undefined}
              onClick={() => setMode(item.value)}
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
                <UnreadIcon unread={mode === "unread"} className="size-2.5" />
              )}
              {item.label}
            </button>
          ))}
        </fieldset>
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/72">
        reader 固有の帯。filter chip 群と補助説明の密度を確認する。
      </p>
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
          "max-w-[18rem] border border-[var(--sidebar-frame-border)] bg-[var(--sidebar-frame-solid-surface)] p-2 text-sidebar-foreground shadow-elevation-1",
        )}
      >
        <AccountsNavView
          accounts={ACCOUNT_CARDS}
          addAccountLabel="アカウントを追加…"
          isAddAccountActive={false}
          onSelectAccount={() => {}}
          onAddAccount={() => {}}
        />
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/72">
        avatar とタイトル、補足行をまとめて見せたいときの密度見本。settings の account list に近い。
      </p>
    </SurfaceCard>
  );
}

export function NavigationButtonPatternsSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Navigation row buttons</SectionHeading>
      <div data-testid="reference-navigation-button-patterns" className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-md border border-border/60 bg-surface-1/70 p-3">
          <div className="mb-2 text-[11px] font-medium tracking-[0.14em] text-foreground-soft uppercase">
            NavRowButton
          </div>
          <div className="space-y-2">
            <NavRowButton
              title="General"
              description="Account and settings section row"
              selected
              leading={<Settings2 className="size-4" />}
              trailing="12"
            />
            <NavRowButton title="Integrations" description="Inactive row with description" trailing="3" />
          </div>
        </div>
        <div className="rounded-md border border-[var(--sidebar-frame-border)] bg-[var(--sidebar-frame-solid-surface)] p-3 text-sidebar-foreground">
          <div className="mb-2 text-[11px] font-medium tracking-[0.14em] text-sidebar-foreground/45 uppercase">
            SidebarNavButton
          </div>
          <div className="space-y-1">
            <SidebarNavButton selected activePane trailing="7">
              <UnreadIcon unread forceTone className="size-3.5" />
              <span className="truncate">Unread</span>
            </SidebarNavButton>
            <SidebarNavButton trailing="2">
              <StarIcon starred forceTone className="size-3.5" />
              <span className="truncate">Starred</span>
            </SidebarNavButton>
          </div>
        </div>
        <div className="rounded-md border border-[var(--sidebar-frame-border)] bg-[var(--sidebar-frame-solid-surface)] p-3 text-sidebar-foreground">
          <div className="mb-2 text-[11px] font-medium tracking-[0.14em] text-sidebar-foreground/45 uppercase">
            Sidebar footer actions
          </div>
          <div className="overflow-hidden rounded-md">
            <SidebarFooterActions
              subscriptionsIndexLabel="購読一覧"
              subscriptionsIndexShortLabel="購読"
              settingsLabel="設定"
              themeToggleLabel="テーマを切り替え"
              onOpenSubscriptionsIndex={() => undefined}
              onOpenSettings={() => undefined}
            />
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}

export function AccountArticleNavigationAlignmentSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Account / article navigation alignment</SectionHeading>
      <div data-testid="reference-account-article-nav-alignment" className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-md border border-[var(--sidebar-frame-border)] bg-[var(--sidebar-frame-solid-surface)] p-2 text-sidebar-foreground shadow-elevation-1">
          <div className="mb-2 px-2 text-[0.66rem] font-semibold tracking-[0.12em] text-sidebar-foreground/50 uppercase">
            Settings accounts
          </div>
          <AccountsNavView
            accounts={ACCOUNT_CARDS}
            addAccountLabel="アカウントを追加…"
            isAddAccountActive={false}
            onSelectAccount={() => {}}
            onAddAccount={() => {}}
          />
        </div>
        <div className="rounded-md border border-[var(--sidebar-frame-border)] bg-[var(--sidebar-frame-solid-surface)] p-2 text-sidebar-foreground shadow-elevation-1">
          <div className="mb-2 px-2 text-[0.66rem] font-semibold tracking-[0.12em] text-sidebar-foreground/50 uppercase">
            Reader account pane
          </div>
          <div className="space-y-1">
            <SidebarNavButton
              selected
              activePane
              registerSidebarNavigationTarget={false}
              selectedIndicatorTone="neutral"
              size="default"
              contentClassName="flex-col items-start gap-0.5"
            >
              <span className="flex max-w-full items-center gap-2 pl-1.5">
                <span className="truncate font-semibold">FreshRSS</span>
              </span>
              <span className="max-w-full truncate pl-1.5 text-xs text-sidebar-foreground/56">今日 01:24</span>
            </SidebarNavButton>
            <SidebarNavButton
              registerSidebarNavigationTarget={false}
              size="default"
              contentClassName="flex-col items-start gap-0.5"
            >
              <span className="flex max-w-full items-center gap-2 pl-1.5">
                <span className="truncate font-medium">debug</span>
                <span className="shrink-0 text-xs text-sidebar-foreground/54">FreshRSS</span>
              </span>
            </SidebarNavButton>
          </div>
        </div>
        <div className="rounded-md border border-[var(--sidebar-frame-border)] bg-[var(--sidebar-frame-solid-surface)] p-2 text-sidebar-foreground shadow-elevation-1">
          <div className="mb-2 px-2 text-[0.66rem] font-semibold tracking-[0.12em] text-sidebar-foreground/50 uppercase">
            Article nav rows
          </div>
          <SmartViewsView
            views={[
              {
                kind: "unread",
                label: "未読",
                count: 1988,
                showCount: true,
                isSelected: true,
              },
              {
                kind: "starred",
                label: "スター",
                count: 2,
                showCount: true,
                isSelected: false,
              },
            ]}
            onSelectSmartView={() => {}}
          />
        </div>
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/72">
        account row は neutral の左バー、smart view は semantic surface で選択を示す。primary accent は購読/feed row
        と行動フィードに限定する。
      </p>
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
          "max-w-[18rem] border border-[var(--sidebar-frame-border)] bg-[var(--sidebar-frame-solid-surface)] p-2 text-sidebar-foreground shadow-elevation-1",
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
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/72">
        folder trigger と feed row の組み合わせ見本。数値列と favicon の密度を見るための断片。
      </p>
    </SurfaceCard>
  );
}

export function PrimitiveCollectionStatesSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Primitive collection states</SectionHeading>
      <div
        data-testid="reference-primitive-collection-states"
        className={cn(
          STACK_SPECIMEN_FRAME_RADIUS_CLASS,
          "grid gap-3 border border-border/70 bg-surface-1/88 p-3 shadow-elevation-1",
        )}
      >
        <ScrollArea
          className="h-32 rounded-md border border-border/60 bg-background/86"
          contentClassName="grid gap-1 p-2"
        >
          {["FreshRSS", "Debug", "Local feeds", "Archive", "Design", "Engineering"].map((item) => (
            <div key={item} className="rounded-md border border-border/45 bg-surface-1/78 px-3 py-2 text-sm">
              {item}
            </div>
          ))}
        </ScrollArea>
        <Collapsible defaultOpen>
          <CollapsibleTrigger
            className="flex w-full items-center justify-between rounded-md border border-border/60 bg-background/86 px-3 py-2 text-left text-sm font-medium text-foreground"
            aria-label="Primitive disclosure open"
          >
            Primitive disclosure
            <span className="text-xs text-foreground/56">open</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 rounded-md border border-border/55 bg-background/74 px-3 py-2 font-serif text-xs leading-[1.45] text-foreground/72">
            Collapsible content keeps disclosure behavior in the primitive layer while feature rows own copy and
            density.
          </CollapsibleContent>
        </Collapsible>
        <div className="grid gap-2 rounded-md border border-border/60 bg-background/86 p-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <TooltipProvider>
          <AppTooltip label="Tooltip copy stays short">
            <Button variant="outline" size="sm" className="w-fit">
              Tooltip target
            </Button>
          </AppTooltip>
        </TooltipProvider>
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/72">
        Scroll, disclosure, loading, and tooltip primitives stay as behavior affordances. Promote only repeated product
        semantics into shared.
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
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/72">
        サイドバーや記事画面で使うタグ色の選択見本。色 chip 群と説明文の関係を見るための断片。
      </p>
    </SurfaceCard>
  );
}
