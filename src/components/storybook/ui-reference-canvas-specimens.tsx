import { Menu } from "@base-ui/react/menu";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import {
  AlertTriangle,
  BookOpen,
  Check,
  Clock3,
  ExternalLink,
  List,
  Palette,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Share,
  Trash2,
  X,
} from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { AccountSwitcherTriggerButton } from "@/components/reader/account-switcher-view";
import { TagOptionRowButton, TagPickerTriggerButton } from "@/components/reader/article-tag-picker-buttons";
import { ArticleToolbarActionStrip } from "@/components/reader/article-toolbar-view";
import { contextMenuStyles } from "@/components/reader/context-menu-styles";
import { FolderSectionView } from "@/components/reader/folder-section";
import { SidebarFooterActions } from "@/components/reader/sidebar-footer-actions";
import { SidebarNavButton } from "@/components/reader/sidebar-nav-button";
import { SmartViewsView } from "@/components/reader/smart-views-view";
import { AccountConnectionSummary } from "@/components/settings/account-connection-summary";
import { AccountsNavView } from "@/components/settings/accounts-nav-view";
import { SettingsActionButton } from "@/components/settings/settings-action-button";
import { SettingsLoadingActionButton } from "@/components/settings/settings-loading-action-button";
import type { AccountNavItem, SettingsNavItem } from "@/components/settings/settings-nav.types";
import { SettingsNavView } from "@/components/settings/settings-nav-view";
import { SettingsSection } from "@/components/settings/settings-section";
import { ShortcutKeyButton } from "@/components/settings/shortcuts-settings-view";
import { AppToastView } from "@/components/shared/app-toast-view";
import { ArticleFilterToggleButton } from "@/components/shared/article-filter-toggle-button";
import { StarIcon, UnreadIcon } from "@/components/shared/article-state-icon";
import { controlChipIconVariants, controlChipVariants } from "@/components/shared/control-chip";
import { ControlChipButton } from "@/components/shared/control-chip-button";
import { DecisionButton, denseDecisionButtonClassName } from "@/components/shared/decision-button";
import { DeleteButton } from "@/components/shared/delete-button";
import { TAG_COLOR_PRESETS } from "@/components/shared/exception-palettes";
import { FeedDetailPanel } from "@/components/shared/feed-detail-panel";
import { FormActionButtons } from "@/components/shared/form-action-buttons";
import { GradientSwitch } from "@/components/shared/gradient-switch";
import {
  IconToolbarButton,
  IconToolbarMenuTrigger,
  IconToolbarSurfaceButton,
  iconToolbarButtonClassName,
} from "@/components/shared/icon-toolbar-control";
import { LabelChip } from "@/components/shared/label-chip";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { LabeledInputRow } from "@/components/shared/labeled-input-row";
import { LabeledSelectRow } from "@/components/shared/labeled-select-row";
import { LabeledSwitchRow } from "@/components/shared/labeled-switch-row";
import { MotionNumber } from "@/components/shared/motion-number";
import { NavRowButton } from "@/components/shared/nav-row-button";
import { SectionHeading } from "@/components/shared/section-heading";
import { SurfaceCard } from "@/components/shared/surface-card";
import { TagChip } from "@/components/shared/tag-chip";
import { TagColorPicker } from "@/components/shared/tag-color-picker";
import { WorkspaceHeaderActionButton } from "@/components/shared/workspace-header";
import type {
  SubscriptionListGroup,
  SubscriptionSummaryCard,
} from "@/components/subscriptions-index/subscriptions-index.types";
import { SubscriptionsListPane } from "@/components/subscriptions-index/subscriptions-list-pane";
import { SubscriptionsOverviewSummary } from "@/components/subscriptions-index/subscriptions-overview-summary";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { AppTooltip, TooltipProvider } from "@/components/ui/tooltip";
import { MOTION_CONTENT_SWAP_CLASS_NAME, MOTION_DATA_PHASE_ATTRIBUTE, MOTION_PHASE_ENTERING } from "@/constants/motion";
import { cn } from "@/lib/utils";
import type { ToastData } from "@/stores/ui-store";
import { useUiStore } from "@/stores/ui-store";

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

type CssVariableProperties = CSSProperties & Record<`--${string}`, string>;

const darkReaderToolbarTokens: CssVariableProperties = {
  "--foreground": "rgba(242, 241, 237, 0.92)",
  "--foreground-soft": "rgba(242, 241, 237, 0.68)",
  "--surface-2": "rgba(242, 241, 237, 0.08)",
  "--surface-3": "rgba(242, 241, 237, 0.12)",
  "--primary": "#f54e00",
  "--ring": "rgba(245, 78, 0, 0.38)",
  "--tone-unread": "#9fbbe0",
  "--tone-starred": "#facc15",
  "--semantic-tone-starred-surface": "rgba(250, 204, 21, 0.16)",
  "--semantic-tone-starred-content-foreground": "#facc15",
  "--semantic-tone-unread-surface": "rgba(159, 187, 224, 0.16)",
  "--semantic-tone-unread-content-foreground": "#9fbbe0",
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
    "text-sidebar-foreground/90 hover:text-sidebar-foreground data-[pressed]:bg-[color-mix(in_srgb,var(--tone-unread)_var(--tone-surface-strength),transparent)] data-[pressed]:text-[var(--semantic-tone-unread-sidebar-foreground)]",
  all: "text-sidebar-foreground/90 hover:text-sidebar-foreground data-[pressed]:bg-[var(--sidebar-pressed-surface)] data-[pressed]:text-sidebar-foreground",
  starred:
    "text-sidebar-foreground/90 hover:text-sidebar-foreground data-[pressed]:bg-[color-mix(in_srgb,var(--tone-starred)_var(--tone-surface-strength),transparent)] data-[pressed]:text-[color-mix(in_srgb,var(--tone-starred)_92%,var(--sidebar-selection-foreground))]",
} as const;

const REFERENCE_NAV_ITEMS: SettingsNavItem[] = [
  {
    id: "general",
    label: "General",
    icon: <Settings2 className="h-4 w-4" />,
    isActive: true,
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: <Palette className="h-4 w-4" />,
    isActive: false,
  },
  {
    id: "reading",
    label: "Reading",
    icon: <BookOpen className="h-4 w-4" />,
    isActive: false,
  },
];

const ACCOUNT_CARDS: AccountNavItem[] = [
  { id: "acc-1", name: "FreshRSS", kind: "freshrss", username: "jey3dayo", isActive: true },
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
    <div className="min-h-screen bg-background px-6 py-8 text-foreground sm:px-8">
      <div className={cn("mx-auto w-full", maxWidthClassName)}>{children}</div>
    </div>
  );
}

const BUTTON_VARIANTS = ["default", "outline", "secondary", "ghost", "destructive", "link"] as const;
const BUTTON_SIZES = ["xs", "sm", "default", "lg", "icon-xs", "icon-sm", "icon", "icon-lg"] as const;
const BUTTON_FAMILY_GUIDE = [
  {
    family: "Button",
    context: "General CTA, dialogs, forms, and empty-state actions.",
    example: "Save changes",
  },
  {
    family: "SettingsActionButton",
    context: "Settings content, header, rail, subtle, and danger actions.",
    example: "Open log directory",
  },
  {
    family: "IconToolbar*",
    context: "Toolbar chrome with tooltips, pressed state, or overlay surfaces.",
    example: "Refresh feeds",
  },
  {
    family: "ControlChipButton",
    context: "Filter chips, toggle chips, and picker triggers.",
    example: "Unread",
  },
  {
    family: "NavRowButton / SidebarNavButton",
    context: "Navigation rows with selected state, leading content, trailing counts, and roving-focus targets.",
    example: "Tech Blog",
  },
  {
    family: "DecisionButton / DeleteButton",
    context: "Meaningful review, defer, keep, and destructive actions.",
    example: "Delete selected",
  },
  {
    family: "WorkspaceHeaderActionButton",
    context: "Workspace header chrome and compact titlebar actions.",
    example: "Close workspace",
  },
] as const;

const SUMMARY_FILTER_CARDS: SubscriptionSummaryCard[] = [
  {
    filterKey: "all",
    label: "すべての購読",
    value: "163",
    caption: "現在管理しているフィード",
    tone: "neutral",
    isActive: true,
  },
  {
    filterKey: "review",
    label: "確認待ち",
    value: "12",
    caption: "継続判断が必要な候補",
    tone: "review",
    isActive: false,
  },
  {
    filterKey: "stale",
    label: "90日以上更新なし",
    value: "8",
    caption: "最近動きがない購読",
    tone: "stale",
    isActive: false,
  },
  {
    filterKey: "all",
    label: "同期状態",
    value: "Ready",
    caption: "押せない static sibling",
    tone: "neutral",
    isActive: false,
    isActionable: false,
  },
];

const SUBSCRIPTION_GROUPS: SubscriptionListGroup[] = [
  {
    key: "folder-design",
    label: "Design",
    folderId: "folder-design",
    rows: [
      {
        folderId: "folder-design",
        folderName: "Design",
        latestArticleAt: "2026-04-29T08:00:00Z",
        status: { tone: "neutral", labelKey: "normal" },
        reasonTooltipKey: null,
        feed: {
          id: "feed-cafict",
          account_id: "account-local",
          folder_id: "folder-design",
          title: "CAFICT",
          url: "https://cafict.com/feed/",
          site_url: "https://cafict.com",
          unread_count: 5,
          reader_mode: "inherit",
          web_preview_mode: "inherit",
        },
      },
      {
        folderId: "folder-design",
        folderName: "Design",
        latestArticleAt: "2026-04-21T11:30:00Z",
        status: { tone: "medium", labelKey: "review" },
        reasonTooltipKey: "review",
        feed: {
          id: "feed-99diy",
          account_id: "account-local",
          folder_id: "folder-design",
          title: "99% DIY -DIYブログ-",
          url: "https://99diy.tokyo/feed/",
          site_url: "https://99diy.tokyo",
          unread_count: 0,
          reader_mode: "inherit",
          web_preview_mode: "inherit",
        },
      },
    ],
  },
  {
    key: "ungrouped",
    label: "フォルダなし",
    folderId: null,
    rows: [
      {
        folderId: null,
        folderName: null,
        latestArticleAt: null,
        status: { tone: "medium", labelKey: "stale_90d" },
        reasonTooltipKey: "stale_90d",
        feed: {
          id: "feed-archive",
          account_id: "account-local",
          folder_id: null,
          title: "Archive notes",
          url: "https://example.com/archive.xml",
          site_url: "https://example.com",
          unread_count: 18,
          reader_mode: "inherit",
          web_preview_mode: "inherit",
        },
      },
    ],
  },
];

export function ButtonFamilyGuideSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Button family guide</SectionHeading>
      <div data-testid="reference-button-family-guide" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {BUTTON_FAMILY_GUIDE.map((item) => (
          <div key={item.family} className="rounded-md border border-border/60 bg-surface-1/70 p-3">
            <div className="text-sm font-medium text-foreground">{item.family}</div>
            <p className="mt-1 text-sm leading-[1.45] text-foreground-soft">{item.context}</p>
            <div className="mt-3 inline-flex min-h-7 items-center rounded-md border border-border/70 bg-background/80 px-2 text-xs font-medium text-foreground-soft">
              {item.example}
            </div>
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}

export function ButtonVariantMatrixSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Button variants</SectionHeading>
      <div data-testid="reference-button-variant-matrix" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {BUTTON_VARIANTS.map((variant) => (
          <div key={variant} className="rounded-md border border-border/60 bg-surface-1/70 p-3">
            <div className="mb-2 text-[11px] font-medium tracking-[0.14em] text-foreground-soft uppercase">
              {variant}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant={variant}>Action</Button>
              <Button variant={variant} disabled>
                Disabled
              </Button>
              {variant === "link" ? null : (
                <Button variant={variant} size="icon-sm" aria-label={`${variant} icon action`}>
                  <Save className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}

export function ButtonSizeMatrixSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Button sizes</SectionHeading>
      <div data-testid="reference-button-size-matrix" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {BUTTON_SIZES.map((size) => (
          <div key={size} className="rounded-md border border-border/60 bg-surface-1/70 p-3">
            <div className="mb-2 text-[11px] font-medium tracking-[0.14em] text-foreground-soft uppercase">{size}</div>
            {size.startsWith("icon") ? (
              <Button size={size} variant="outline" aria-label={`${size} action`}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            ) : (
              <Button size={size} variant="outline">
                {size} action
              </Button>
            )}
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}

export function SettingsActionButtonSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Settings action buttons</SectionHeading>
      <div data-testid="reference-settings-action-button-matrix" className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-md border border-border/60 bg-surface-1/70 p-3">
          <div className="mb-2 text-[11px] font-medium tracking-[0.14em] text-foreground-soft uppercase">
            Content and header
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SettingsActionButton>Open log directory</SettingsActionButton>
            <SettingsActionButton tone="header">Reset to defaults</SettingsActionButton>
            <SettingsActionButton tone="subtle" size="compact">
              Back
            </SettingsActionButton>
            <SettingsActionButton tone="danger" size="compact">
              Remove
            </SettingsActionButton>
          </div>
        </div>
        <div className="rounded-md border border-[var(--sidebar-frame-border)] bg-[var(--sidebar-frame-solid-surface)] p-3 text-sidebar-foreground">
          <div className="mb-2 text-[11px] font-medium tracking-[0.14em] text-sidebar-foreground/45 uppercase">
            Rail action
          </div>
          <div className="inline-flex rounded-lg border border-[var(--sidebar-frame-border)] bg-[var(--sidebar-frame-surface)] p-1 shadow-elevation-1">
            <SettingsActionButton tone="rail" size="icon" aria-label="Close settings">
              <X className="h-4 w-4" />
            </SettingsActionButton>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}

export function LoadingAndFormActionsSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Form and loading actions</SectionHeading>
      <div data-testid="reference-form-loading-actions" className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-md border border-border/60 bg-surface-1/70 p-3">
          <div className="mb-2 text-[11px] font-medium tracking-[0.14em] text-foreground-soft uppercase">
            Form footer
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FormActionButtons
              cancelLabel="Cancel"
              submitLabel="Save"
              onCancel={() => undefined}
              onSubmit={() => undefined}
            />
          </div>
        </div>
        <div className="rounded-md border border-border/60 bg-surface-1/70 p-3">
          <div className="mb-2 text-[11px] font-medium tracking-[0.14em] text-foreground-soft uppercase">
            Loading settings action
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SettingsLoadingActionButton loading loadingLabel="Syncing">
              Sync now
            </SettingsLoadingActionButton>
            <SettingsLoadingActionButton disabled>Disabled</SettingsLoadingActionButton>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}

export function SemanticActionButtonsSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Semantic action buttons</SectionHeading>
      <div data-testid="reference-semantic-action-buttons" className="flex flex-wrap items-center gap-2">
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
        <DeleteButton>Delete permanently</DeleteButton>
      </div>
    </SurfaceCard>
  );
}

export function IconUtilityButtonSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Icon utility actions</SectionHeading>
      <TooltipProvider>
        <div data-testid="reference-icon-utility-buttons" className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-md border border-border/60 bg-surface-1/70 p-3">
            <div className="mb-2 text-[11px] font-medium tracking-[0.14em] text-foreground-soft uppercase">Toolbar</div>
            <div className="flex items-center gap-2">
              <IconToolbarButton label="Refresh feeds" onClick={() => undefined}>
                <RefreshCw className="h-4 w-4" />
              </IconToolbarButton>
              <IconToolbarButton label="Open in browser" ariaPressed onClick={() => undefined}>
                <ExternalLink className="h-4 w-4" />
              </IconToolbarButton>
            </div>
          </div>
          <div className="rounded-md border border-border/60 bg-surface-1/70 p-3">
            <div className="mb-2 text-[11px] font-medium tracking-[0.14em] text-foreground-soft uppercase">
              Overlay surface
            </div>
            <div className="flex items-center gap-2">
              <IconToolbarSurfaceButton label="Close Web Preview" onClick={() => undefined}>
                <X className="h-4 w-4" />
              </IconToolbarSurfaceButton>
              <IconToolbarSurfaceButton label="Reload page" variant="chrome" onClick={() => undefined}>
                <RefreshCw className="h-4 w-4" />
              </IconToolbarSurfaceButton>
            </div>
          </div>
          <div className="rounded-md border border-border/60 bg-surface-1/70 p-3">
            <div className="mb-2 text-[11px] font-medium tracking-[0.14em] text-foreground-soft uppercase">
              Workspace header
            </div>
            <div className="flex items-center gap-2">
              <WorkspaceHeaderActionButton aria-label="Close workspace">
                <X className="h-4 w-4" />
              </WorkspaceHeaderActionButton>
              <WorkspaceHeaderActionButton presentation="text">Shortcut</WorkspaceHeaderActionButton>
            </div>
          </div>
        </div>
      </TooltipProvider>
    </SurfaceCard>
  );
}

export function ArticleFilterToggleButtonSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Article filter toggle buttons</SectionHeading>
      <div data-testid="reference-article-filter-toggle-buttons" className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-md border border-border/60 bg-surface-1/70 p-3">
          <div className="mb-2 text-[11px] font-medium tracking-[0.14em] text-foreground-soft uppercase">
            Colored state filters
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ArticleFilterToggleButton mode="unread" pressed value="unread" aria-label="Unread">
              Unread
            </ArticleFilterToggleButton>
            <ArticleFilterToggleButton mode="starred" pressed value="starred" aria-label="Starred">
              Starred
            </ArticleFilterToggleButton>
            <ArticleFilterToggleButton mode="all" pressed={false} value="all" aria-label="All">
              All
            </ArticleFilterToggleButton>
          </div>
        </div>
        <div className="rounded-md border border-border/60 bg-surface-1/70 p-3">
          <div className="mb-2 text-[11px] font-medium tracking-[0.14em] text-foreground-soft uppercase">
            Compact inactive states
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ArticleFilterToggleButton mode="unread" pressed={false} size="compact" value="unread" aria-label="Unread">
              Unread
            </ArticleFilterToggleButton>
            <ArticleFilterToggleButton
              mode="starred"
              pressed={false}
              size="compact"
              value="starred"
              aria-label="Starred"
            >
              Starred
            </ArticleFilterToggleButton>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}

export function ReaderHeaderActionStripSpecimen() {
  const [isRead, setIsRead] = useState(false);
  const [isStarred, setIsStarred] = useState(true);
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [darkIsRead, setDarkIsRead] = useState(false);
  const [darkIsStarred, setDarkIsStarred] = useState(true);
  const [darkIsBrowserOpen, setDarkIsBrowserOpen] = useState(true);

  useEffect(() => {
    const previousLayoutMode = useUiStore.getState().layoutMode;
    useUiStore.setState({ layoutMode: "mobile" });
    return () => useUiStore.setState({ layoutMode: previousLayoutMode });
  }, []);

  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Reader header action strip</SectionHeading>
      <TooltipProvider>
        <div className="grid grid-cols-2 gap-3">
          <div
            data-testid="reference-reader-header-action-strip"
            className="flex min-h-12 items-center justify-end rounded-md bg-surface-1/72 px-2.5 py-1.5 shadow-elevation-1"
            style={{ backgroundColor: "var(--reader-toolbar-surface)" }}
          >
            <ArticleToolbarActionStrip
              hasArticle
              canToggleRead
              canToggleStar
              isRead={isRead}
              isStarred={isStarred}
              isBrowserOpen={isBrowserOpen}
              showCopyLinkButton
              canCopyLink
              showOpenInBrowserButton
              canOpenInBrowser
              showOpenInExternalBrowserButton
              canOpenInExternalBrowser
              labels={{
                closeView: "Close article",
                toggleRead: "Toggle read",
                toggleReadShort: "Read",
                toggleStar: "Toggle star",
                toggleStarShort: "Star",
                copyLink: "Copy link",
                previewToggleOff: "Open Web Preview",
                previewToggleOffShort: "Preview",
                previewToggleOn: "Close Web Preview",
                previewToggleOnShort: "Close",
                openInExternalBrowser: "Open in External Browser",
                moreActions: "More actions",
              }}
              onToggleRead={setIsRead}
              onToggleStar={setIsStarred}
              onCopyLink={() => undefined}
              onOpenInBrowser={() => setIsBrowserOpen((current) => !current)}
              onOpenInExternalBrowser={() => undefined}
              shareMenuControl={
                <Menu.Root>
                  <IconToolbarMenuTrigger label="Share">
                    <Share className="h-4 w-4" />
                  </IconToolbarMenuTrigger>
                </Menu.Root>
              }
            />
          </div>
          <div
            data-testid="reference-reader-header-action-strip-dark"
            className="dark flex min-h-12 items-center justify-end rounded-md bg-[#191712] px-2.5 py-1.5 text-foreground shadow-[0_12px_32px_-24px_rgba(0,0,0,0.72)]"
            style={darkReaderToolbarTokens}
          >
            <ArticleToolbarActionStrip
              hasArticle
              canToggleRead
              canToggleStar
              isRead={darkIsRead}
              isStarred={darkIsStarred}
              isBrowserOpen={darkIsBrowserOpen}
              showCopyLinkButton
              canCopyLink
              showOpenInBrowserButton
              canOpenInBrowser
              showOpenInExternalBrowserButton
              canOpenInExternalBrowser
              labels={{
                closeView: "Close article",
                toggleRead: "Toggle read",
                toggleReadShort: "Read",
                toggleStar: "Toggle star",
                toggleStarShort: "Star",
                copyLink: "Copy link",
                previewToggleOff: "Open Web Preview",
                previewToggleOffShort: "Preview",
                previewToggleOn: "Close Web Preview",
                previewToggleOnShort: "Close",
                openInExternalBrowser: "Open in External Browser",
                moreActions: "More actions",
              }}
              onToggleRead={setDarkIsRead}
              onToggleStar={setDarkIsStarred}
              onCopyLink={() => undefined}
              onOpenInBrowser={() => setDarkIsBrowserOpen((current) => !current)}
              onOpenInExternalBrowser={() => undefined}
              shareMenuControl={
                <Menu.Root>
                  <IconToolbarMenuTrigger label="Share">
                    <Share className="h-4 w-4" />
                  </IconToolbarMenuTrigger>
                </Menu.Root>
              }
            />
          </div>
        </div>
      </TooltipProvider>
    </SurfaceCard>
  );
}

export function SpecializedButtonPatternsSpecimen() {
  const [tagColor, setTagColor] = useState<string | null>(TAG_COLOR_PRESETS[2]);
  const [tagPickerExpanded, setTagPickerExpanded] = useState(false);

  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Specialized button patterns</SectionHeading>
      <div data-testid="reference-specialized-button-patterns" className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-md border border-border/60 bg-surface-1/70 p-3">
          <div className="mb-2 text-[11px] font-medium tracking-[0.14em] text-foreground-soft uppercase">
            Tag chip action
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TagChip
              label="design"
              color={TAG_COLOR_PRESETS[2]}
              onRemove={() => undefined}
              removeLabel="Remove design"
            />
            <TagChip label="reader" onRemove={() => undefined} removeLabel="Remove reader" />
          </div>
        </div>
        <div className="rounded-md border border-border/60 bg-surface-1/70 p-3">
          <div className="mb-2 text-[11px] font-medium tracking-[0.14em] text-foreground-soft uppercase">
            Tag picker trigger
          </div>
          <div className="flex flex-col items-start gap-2">
            <TagPickerTriggerButton
              expanded={tagPickerExpanded}
              aria-expanded={tagPickerExpanded}
              aria-label="Add tag"
              onClick={() => setTagPickerExpanded((current) => !current)}
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
              <span>Add tag</span>
            </TagPickerTriggerButton>
            <TagPickerTriggerButton compact aria-label="Add compact tag">
              <Plus className="h-3 w-3" aria-hidden="true" />
            </TagPickerTriggerButton>
            <div className="w-full rounded-md border border-border/60 bg-surface-2 p-1.5">
              <TagOptionRowButton swatchColor={TAG_COLOR_PRESETS[2]}>design</TagOptionRowButton>
              <TagOptionRowButton>reader</TagOptionRowButton>
            </div>
          </div>
        </div>
        <div className="rounded-md border border-border/60 bg-surface-1/70 p-3">
          <div className="mb-2 text-[11px] font-medium tracking-[0.14em] text-foreground-soft uppercase">
            Tag color swatches
          </div>
          <TagColorPicker
            color={tagColor}
            colorOptions={TAG_COLOR_PRESETS.slice(0, 5)}
            noColorLabel="No color"
            optionAriaLabel={(option) => `Select ${option}`}
            onChange={setTagColor}
          />
        </div>
        <div className="rounded-md border border-[var(--sidebar-frame-border)] bg-[var(--sidebar-frame-solid-surface)] p-3 text-sidebar-foreground">
          <div className="mb-2 text-[11px] font-medium tracking-[0.14em] text-sidebar-foreground/58 uppercase">
            Account switcher trigger
          </div>
          <div className="space-y-3">
            <AccountSwitcherTriggerButton
              accountName="Local"
              lastSyncedLabel="Today at 10:42"
              canOpenAccountList
              hasMultipleAccounts
              isExpanded={false}
            />
            <AccountSwitcherTriggerButton
              accountName="Single"
              lastSyncedLabel="Not synced yet"
              canOpenAccountList
              hasMultipleAccounts={false}
            />
          </div>
        </div>
        <div className="rounded-md border border-border/60 bg-surface-1/70 p-3">
          <div className="mb-2 text-[11px] font-medium tracking-[0.14em] text-foreground-soft uppercase">
            Shortcut key capture
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <ShortcutKeyButton>⌘K</ShortcutKeyButton>
            <ShortcutKeyButton recording>Press a key</ShortcutKeyButton>
            <div className="flex flex-col items-stretch gap-1">
              <ShortcutKeyButton conflict>⌘R</ShortcutKeyButton>
              <span className="text-[10px] text-state-danger-foreground">Conflict</span>
            </div>
          </div>
        </div>
      </div>
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
              leading={<Settings2 className="h-4 w-4" />}
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
              <UnreadIcon unread forceTone className="h-3.5 w-3.5" />
              <span className="truncate">Unread</span>
            </SidebarNavButton>
            <SidebarNavButton trailing="2">
              <StarIcon starred forceTone className="h-3.5 w-3.5" />
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

export function LeftBandShellSpecimen() {
  return (
    <aside
      className={cn(SHELL_SPECIMEN_OUTER_RADIUS_CLASS, "border border-border/60 bg-card/40 p-3 shadow-elevation-1")}
    >
      <AnnotatedNote
        title="Left Band"
        body="Use the existing settings rail as the shell outer frame. Let spacing and tonal shifts do the work before adding stronger accents."
      />
      <div
        className={cn(
          "mt-3 border border-[var(--sidebar-frame-border)] bg-[var(--sidebar-frame-surface)]",
          SHELL_SPECIMEN_INNER_RADIUS_CLASS,
        )}
      >
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
                    "inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm shadow-elevation-1 transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                    checked
                      ? "border-border-strong bg-surface-3 text-foreground"
                      : "border-border bg-surface-1 text-foreground/72 hover:bg-surface-2",
                  )}
                >
                  <Radio.Root
                    value={option.value}
                    aria-label={option.label}
                    className={cn(
                      "flex size-4 items-center justify-center rounded-full border transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
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
        label="Display name"
        name="display_name"
        value="Main reader"
        onChange={() => {}}
        placeholder="Main reader"
        controlClassName="flex w-full items-center gap-2 sm:max-w-[30rem] sm:justify-end"
        inputClassName="h-10 flex-1"
        actionLabel="Reset"
        actionClassName="h-10 px-4 text-sm font-medium"
        onAction={() => {}}
        actionDisabled={false}
      />
      <LabeledInputRow
        label="Tag name"
        name="tag_name"
        value="News"
        onChange={() => {}}
        placeholder="News"
        controlClassName="flex-col items-stretch sm:flex-row sm:items-center"
        inputClassName="h-10 flex-1"
        actionLabel="Create"
        actionAriaLabel="Create"
        actionClassName="h-10 w-full justify-center px-4 text-sm font-medium sm:w-auto"
        onAction={() => {}}
        actionDisabled={false}
      />
      <LabeledInputRow
        label="Feed URL"
        name="feed_url"
        type="url"
        value=""
        onChange={() => {}}
        placeholder="https://example.com/feed.xml"
        actionLabel="Discover"
        actionAriaLabel="Discover feed"
        actionPlacement="inside"
        onAction={() => {}}
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

export function PrimitiveControlMatrixSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Primitive control states</SectionHeading>
      <div
        data-testid="reference-primitive-control-matrix"
        className="grid gap-3 rounded-md border border-border/70 bg-surface-1/90 p-3 md:grid-cols-2"
      >
        <div className="grid gap-2">
          <label htmlFor="reference-primitive-input-default" className="font-sans text-xs text-foreground/72">
            Input / default
          </label>
          <Input
            id="reference-primitive-input-default"
            aria-label="Primitive input default"
            defaultValue="https://example.com/feed.xml"
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="reference-primitive-input-invalid" className="font-sans text-xs text-foreground/72">
            Input / invalid
          </label>
          <Input
            id="reference-primitive-input-invalid"
            aria-label="Primitive input invalid"
            defaultValue="freshrss.local"
            aria-invalid="true"
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="reference-primitive-input-disabled" className="font-sans text-xs text-foreground/72">
            Input / disabled
          </label>
          <Input
            id="reference-primitive-input-disabled"
            aria-label="Primitive input disabled"
            defaultValue="Locked account"
            disabled
          />
        </div>
        <div className="grid gap-2">
          <span className="font-sans text-xs text-foreground/72">Select / default</span>
          <Select defaultValue="Comfortable">
            <SelectTrigger aria-label="Primitive select default" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="Compact">Compact</SelectItem>
              <SelectItem value="Comfortable">Comfortable</SelectItem>
              <SelectItem value="Spacious">Spacious</SelectItem>
            </SelectPopup>
          </Select>
        </div>
        <div className="grid gap-2">
          <span className="font-sans text-xs text-foreground/72">Select / invalid</span>
          <Select defaultValue="Missing folder">
            <SelectTrigger aria-label="Primitive select invalid" aria-invalid="true" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="Missing folder">Missing folder</SelectItem>
              <SelectItem value="Inbox">Inbox</SelectItem>
            </SelectPopup>
          </Select>
        </div>
        <div className="grid gap-2">
          <span className="font-sans text-xs text-foreground/72">Select / disabled</span>
          <Select defaultValue="Offline">
            <SelectTrigger aria-label="Primitive select disabled" className="w-full" disabled>
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="Offline">Offline</SelectItem>
            </SelectPopup>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-background/70 px-3 py-2">
          <span className="font-sans text-xs text-foreground/72">Checkbox / checked</span>
          <Checkbox aria-label="Primitive checkbox checked" checked onCheckedChange={() => {}} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-background/70 px-3 py-2">
          <span className="font-sans text-xs text-foreground/72">Checkbox / disabled</span>
          <Checkbox aria-label="Primitive checkbox disabled" disabled />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-background/70 px-3 py-2">
          <span className="font-sans text-xs text-foreground/72">Switch / checked</span>
          <Switch aria-label="Primitive switch checked" checked onCheckedChange={() => {}} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-background/70 px-3 py-2">
          <span className="font-sans text-xs text-foreground/72">Switch / disabled</span>
          <Switch aria-label="Primitive switch disabled" disabled />
        </div>
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/72">
        Low-level primitives stay thin. Use this matrix to verify base states before promoting a repeated product
        pattern into shared.
      </p>
    </SurfaceCard>
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
            <span className="rounded-full border border-dashed border-border/70 px-2.5 py-1 text-[11px] text-foreground/72">
              工事中
            </span>
            <GradientSwitch checked={false} disabled aria-label="ミュート時に自動既読" />
          </div>
        </LabeledControlRow>
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/72">
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

export function ReaderFilterStripSpecimen() {
  const [mode, setMode] = useState<ReaderFilterMode>("unread");

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
                <UnreadIcon unread={mode === "unread"} className="h-2.5 w-2.5" />
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
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/72">
        密度の高いワークスペースでは、pill よりも少し角張った filter chip
        を優先する。件数バッジはさらに一段小さく角を落として、本文ラベルより控えめに扱う。
      </p>
    </SurfaceCard>
  );
}

export function MotionNumberSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Short numeric swaps</SectionHeading>
      <div
        data-testid="reference-motion-number-frame"
        className={cn(
          STACK_SPECIMEN_FRAME_RADIUS_CLASS,
          "grid gap-3 border border-border/70 bg-surface-1/88 px-3 py-3 shadow-elevation-1",
        )}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-md border border-border/55 bg-card/48 px-3 py-2">
          <span className="truncate text-sm font-medium text-foreground">Unread queue</span>
          <MotionNumber value={27} variant="digit-pop" className="text-sm font-semibold text-foreground" />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-md border border-border/55 bg-card/48 px-3 py-2">
          <span className="truncate text-sm font-medium text-foreground">Search results</span>
          <MotionNumber value={8} variant="digit-pop" className="text-sm font-semibold text-foreground" />
        </div>
        <div className="flex flex-wrap gap-2">
          <ControlChipButton pressed size="comfortable" className="gap-2 rounded-md px-3.5">
            <span>未読なし</span>
            <LabelChip tone="muted" size="compact" className="rounded-sm px-1.5">
              <MotionNumber value={163} variant="digit-pop" />
            </LabelChip>
          </ControlChipButton>
          <ControlChipButton pressed={false} size="comfortable" className="gap-2 rounded-md px-3.5">
            <span>スターなし</span>
            <LabelChip tone="muted" size="compact" className="rounded-sm px-1.5">
              <MotionNumber value={42} variant="digit-pop" />
            </LabelChip>
          </ControlChipButton>
        </div>
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/72">
        件数バッジ、検索結果数、同期カウントのような短い数値だけに使う。記事本文、長いタイトル、フィード名は動かさない。
      </p>
    </SurfaceCard>
  );
}

export function SummaryFilterCardsSpecimen() {
  const [activeFilter, setActiveFilter] = useState<SubscriptionSummaryCard["filterKey"]>("all");
  const cards = SUMMARY_FILTER_CARDS.map((card) => ({
    ...card,
    isActive: card.isActionable !== false && card.filterKey === activeFilter,
  }));

  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Summary filter cards</SectionHeading>
      <div data-testid="reference-summary-filter-card-frame">
        <SubscriptionsOverviewSummary cards={cards} onSelectFilter={setActiveFilter} />
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/72">
        card 全体が filter button になる workspace summary。active accent、badge slot、numeric typography、押せない
        static sibling の差分をここで確認してから wrapper 化する。
      </p>
    </SurfaceCard>
  );
}

export function SubscriptionGroupDisclosureSpecimen() {
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(new Set(["folder-design"]));
  const [selectedFeedId, setSelectedFeedId] = useState("feed-cafict");

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Subscription group disclosure</SectionHeading>
      <div
        data-testid="reference-subscription-group-disclosure-frame"
        className="overflow-hidden rounded-md border border-border/55"
      >
        <SubscriptionsListPane
          heading="購読一覧"
          groups={SUBSCRIPTION_GROUPS}
          selectedFeedId={selectedFeedId}
          emptyLabel="購読はありません"
          statusLabels={{
            normal: "確認済み",
            review: "確認待ち",
            stale_90d: "90日以上更新なし",
            no_unread: "未読なし",
            no_stars: "スターなし",
          }}
          reasonTooltipLabels={{
            no_articles: "記事がまだ取れていないため、見直し候補にはしていません",
            normal: "最近も動きがあります",
            review: "見直しの判断材料があります",
            stale_90d: "最後に取得した記事から90日以上たっています",
            no_unread: "取得済みの記事に未読がありません",
            no_stars: "取得済みの記事にスターがありません",
          }}
          formatUnreadCountLabel={(count) => `${count} unread`}
          formatLatestArticleLabel={(value) => (value ? "最終更新あり" : "更新なし")}
          isGroupExpanded={(groupKey) => expandedGroups.has(groupKey)}
          onSelectFeed={setSelectedFeedId}
          onToggleGroup={toggleGroup}
        />
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/72">
        folder row は disclosure button と drop target を兼ねる。aria-expanded、count chip、motion disclosure、feed row
        との余白をこの基準面で確認する。
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
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/72">
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
          primaryAction={{
            label: "フィードを編集",
            onClick: () => {},
            ariaLabel: "フィードを編集",
          }}
          reasonChips={["一度見ておきたい購読"]}
        />
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/72">
        panel は単一 action card ではなく、title、status、reason、metrics、recent articles を束ねる detail
        surface。summary card より情報密度を高くし、primary action は末尾に閉じ込める。
      </p>
    </SurfaceCard>
  );
}

export function WorkspaceTwoPaneSpecimen() {
  const entries = [
    {
      id: "automaton",
      title: "AUTOMATON",
      href: "https://automaton-media.com",
      folder: "Gaming",
      latestArticle: "2026/04/16",
      unread: 0,
      starred: 0,
      status: "Review",
      statusTone: "medium" as const,
      article: "SIE新作高難度3D弾幕ローグライトシューター『SAROS』開発者インタビュー。",
    },
    {
      id: "publickey",
      title: "Publickey",
      href: "https://www.publickey1.jp",
      folder: "Engineering",
      latestArticle: "2026/04/28",
      unread: 2,
      starred: 1,
      status: "Watch",
      statusTone: "low" as const,
      article: "クラウドネイティブな開発環境とフロントエンド基盤の最新動向。",
    },
    {
      id: "nhk",
      title: "NHKニュース",
      href: "https://www3.nhk.or.jp/news/",
      folder: "News",
      latestArticle: "2026/04/30",
      unread: 4,
      starred: 0,
      status: "Normal",
      statusTone: "neutral" as const,
      article: "国内外の主要ニュースを短く確認するための定点観測フィード。",
    },
  ];
  const [selectedEntryId, setSelectedEntryId] = useState(entries[0].id);
  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) ?? entries[0];

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
                <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">90日停止</p>
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
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  aria-pressed={entry.id === selectedEntryId}
                  onClick={() => setSelectedEntryId(entry.id)}
                  className={cn(
                    "motion-static-hover-surface w-full rounded-md border border-border/70 bg-background/86 px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
                    entry.id === selectedEntryId &&
                      "border-border-strong bg-surface-2/82 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]",
                  )}
                >
                  <p className="font-sans text-sm text-foreground">{entry.title}</p>
                  <p className="mt-1 font-serif text-xs leading-[1.45] text-foreground/72">
                    選択中の feed に応じて detail pane を更新する二段構成。
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div
          key={selectedEntry.id}
          data-testid="reference-workspace-two-pane-detail"
          {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
          className={cn(
            MOTION_CONTENT_SWAP_CLASS_NAME,
            "rounded-md border border-border/70 bg-surface-1/84 px-3 py-3 shadow-none",
          )}
        >
          <FeedDetailPanel
            title={selectedEntry.title}
            titleHref={selectedEntry.href}
            badgeLabel={selectedEntry.status}
            badgeTone={selectedEntry.statusTone}
            reasonBox={{
              title: "整理候補になった理由",
              body: `未読 ${selectedEntry.unread}件 / スター ${selectedEntry.starred}件`,
              tone: selectedEntry.statusTone,
            }}
            metrics={[
              { label: "フォルダ", value: selectedEntry.folder },
              { label: "最終記事", value: selectedEntry.latestArticle },
              { label: "未読", value: selectedEntry.unread },
              { label: "スター", value: selectedEntry.starred },
            ]}
            links={[]}
            recentArticlesHeading="最近の記事"
            recentArticles={[
              {
                id: `ref-${selectedEntry.id}`,
                title: selectedEntry.article,
                publishedAt: selectedEntry.latestArticle,
                url: "https://example.com/article",
              },
            ]}
            primaryAction={{
              label: "フィードを編集",
              onClick: () => {},
              ariaLabel: "フィードを編集",
            }}
            reasonChips={["一度見ておきたい購読"]}
          />
        </div>
      </div>
    </SurfaceCard>
  );
}

export function SettingsHeaderSummarySpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Settings header summary</SectionHeading>
      <div
        data-testid="reference-settings-header-summary-frame"
        className="grid gap-3 rounded-md border border-border/70 bg-card/30 p-3 shadow-none lg:grid-cols-3"
      >
        <div className="rounded-md border border-border/70 bg-background/88 p-3">
          <p className="mb-3 font-sans text-[20px] tracking-[-0.03em] text-foreground">FreshRSS</p>
          <AccountConnectionSummary statusLabel="確認済み" statusTone="success" detail="今日 01:06" />
        </div>
        <div className="rounded-md border border-border/70 bg-background/88 p-3">
          <p className="mb-3 font-sans text-[20px] tracking-[-0.03em] text-foreground">FreshRSS</p>
          <AccountConnectionSummary statusLabel="未確認" statusTone="warning" detail="まだ取得できていません" />
        </div>
        <div className="rounded-md border border-border/70 bg-background/88 p-3">
          <p className="mb-3 font-sans text-[20px] tracking-[-0.03em] text-foreground">FreshRSS</p>
          <AccountConnectionSummary statusLabel="未認証" statusTone="danger" detail="認証に失敗しています" />
        </div>
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/72">
        settings の見出し右で account status を要約する見本。入力行ではなく header-level summary として扱う。
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
          "max-w-[18rem] border border-[var(--sidebar-frame-border)] bg-[var(--sidebar-frame-solid-surface)] px-2 py-2 text-sidebar-foreground shadow-elevation-1",
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
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/72">
        avatar とタイトル、補足行をまとめて見せたいときの密度見本。settings の account list に近い。
      </p>
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
            addAccountLabel="アカウントを追加..."
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
              { kind: "unread", label: "未読", count: 1988, showCount: true, isSelected: true },
              { kind: "starred", label: "スター", count: 2, showCount: true, isSelected: false },
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

export function AnnouncementCardsSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Announcement cards</SectionHeading>
      <div className="flex flex-wrap items-center gap-4">
        <div
          data-testid="reference-announcement-card-pending"
          className={cn(
            STACK_SPECIMEN_FRAME_RADIUS_CLASS,
            "flex items-center gap-4 border border-border/55 bg-surface-1/72 px-4 py-3 shadow-none",
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
            "flex items-center gap-4 border border-state-success-border/70 bg-state-success-surface/68 px-4 py-3 shadow-none",
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
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/72">
        announcement card は押せる summary card と混ぜない。hover affordance、action chip、active badge を持たない
        passive surface として扱う。
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
          "max-w-[18rem] border border-[var(--sidebar-frame-border)] bg-[var(--sidebar-frame-solid-surface)] px-2 py-2 text-sidebar-foreground shadow-elevation-1",
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
      <div className="grid gap-3 xl:grid-cols-3">
        <div
          className={cn(
            SHELL_SPECIMEN_OUTER_RADIUS_CLASS,
            "border border-border/60 bg-card/36 px-4 py-4 shadow-elevation-1 sm:px-5 sm:py-5",
          )}
        >
          <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-foreground/72">Dialog shell</div>
          <p className="mb-3 font-serif text-xs leading-[1.45] text-foreground/72">
            Outer shell only. Keep the inner dialog component surface separate and smaller-radius.
          </p>
          <div className={cn(SHELL_SPECIMEN_INNER_RADIUS_CLASS, "border border-border/70 bg-background/70 p-4")}>
            <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-foreground/72">Dialog shell frame</div>
            <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-foreground/72">
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
          <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-foreground/72">Utility action chrome</div>
          <p className="mb-3 font-serif text-xs leading-[1.45] text-foreground/72">
            Resting state stays borderless. Selection comes from tonal fill and semantic icon tint, while focus remains
            a separate layer.
          </p>
          <div className={cn(SHELL_SPECIMEN_INNER_RADIUS_CLASS, "border border-border/70 bg-background/70 p-4")}>
            <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-foreground/72">
              Sidebar or toolbar chrome
            </div>
            <div
              data-testid="reference-utility-action-chrome-strip"
              className="flex items-center gap-2 rounded-lg bg-[color-mix(in_srgb,var(--foreground)_86%,var(--background))] px-3 py-3 text-[color:var(--background)]"
            >
              <Button
                variant="ghost"
                size="icon"
                aria-label="Refresh"
                className={cn(
                  iconToolbarButtonClassName,
                  "hover:bg-[color-mix(in_srgb,var(--foreground)_78%,var(--background))] hover:text-[color:var(--background)] focus-visible:bg-[color-mix(in_srgb,var(--foreground)_78%,var(--background))]",
                )}
              >
                <Clock3 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Unread"
                className={cn(
                  iconToolbarButtonClassName,
                  "hover:bg-[color-mix(in_srgb,var(--foreground)_78%,var(--background))] hover:text-[color:var(--background)] focus-visible:bg-[color-mix(in_srgb,var(--foreground)_78%,var(--background))]",
                )}
              >
                <UnreadIcon unread={true} className="h-2.5 w-2.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Starred"
                className={cn(
                  iconToolbarButtonClassName,
                  "bg-[var(--semantic-tone-starred-surface)] text-[var(--semantic-tone-starred-content-foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-[var(--semantic-tone-starred-surface)] hover:text-[var(--semantic-tone-starred-content-foreground)]",
                )}
              >
                <StarIcon starred={true} className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Preview"
                className={cn(
                  iconToolbarButtonClassName,
                  "bg-primary/12 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-primary/12 hover:text-primary",
                )}
              >
                <Check className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <div
          className={cn(
            SHELL_SPECIMEN_OUTER_RADIUS_CLASS,
            "border border-border/60 bg-card/36 px-4 py-4 shadow-elevation-1 sm:px-5 sm:py-5",
          )}
        >
          <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-foreground/72">Context menu shell</div>
          <p className="mb-3 font-serif text-xs leading-[1.45] text-foreground/72">
            This is the workspace frame around the menu body, not the reusable menu body itself.
          </p>
          <div className={cn(SHELL_SPECIMEN_INNER_RADIUS_CLASS, "border border-border/70 bg-background/70 p-4")}>
            <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-foreground/72">
              Context menu shell frame
            </div>
            <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-foreground/72">Inner menu body</div>
            <div className="inline-flex rounded-md border border-border px-3 py-2 text-sm text-foreground">Feed</div>
            <div className="mt-3 min-w-[200px] rounded-lg border border-border bg-popover p-1 text-sm text-popover-foreground shadow-elevation-2 outline-none">
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

export function CommandPaletteShellSpecimen() {
  return (
    <SurfaceCard variant="section" data-testid="reference-command-palette-shell">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div>
          <SectionHeading className="mb-2">Command palette shell</SectionHeading>
          <p className="font-serif text-sm leading-[1.45] text-foreground/72">
            Command stays a primitive-backed overlay surface. Feature commands provide the grouping, labels, and
            shortcuts.
          </p>
        </div>
        <div className={cn(SHELL_SPECIMEN_OUTER_RADIUS_CLASS, "border border-border/70 bg-background/70 p-4")}>
          <Command className="rounded-lg border border-border bg-popover text-popover-foreground shadow-elevation-2">
            <CommandInput aria-label="Reference command search" placeholder="Search reader actions..." />
            <CommandList className="max-h-none">
              <CommandGroup heading="Reader">
                <CommandItem value="sync-all">
                  <RefreshCw className="size-4" />
                  Sync all feeds
                  <CommandShortcut>⌘R</CommandShortcut>
                </CommandItem>
                <CommandItem value="save-reader-layout">
                  <Save className="size-4" />
                  Save reader layout
                  <CommandShortcut>⌘S</CommandShortcut>
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Navigation">
                <CommandItem value="open-settings">
                  <Settings2 className="size-4" />
                  Open settings
                  <CommandShortcut>⌘,</CommandShortcut>
                </CommandItem>
                <CommandItem value="copy-link">
                  <Share className="size-4" />
                  Copy current link
                  <CommandShortcut>⇧⌘C</CommandShortcut>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      </div>
    </SurfaceCard>
  );
}

const updateToastSpecimens = [
  {
    label: "Download 0%",
    testId: "reference-update-toast-download-0",
    toast: {
      message: "ダウンロード中… 0%",
      persistent: true,
      progress: 0,
      variant: "update",
    },
  },
  {
    label: "Download 90%",
    testId: "reference-update-toast-download-90",
    toast: {
      message: "ダウンロード中… 90%",
      persistent: true,
      progress: 90,
      variant: "update",
    },
  },
  {
    label: "Ready",
    testId: "reference-update-toast-ready",
    toast: {
      message: "更新の準備ができました",
      persistent: true,
      variant: "update",
      actions: [
        { label: "再起動", onClick: () => {} },
        { label: "後で", onClick: () => {} },
      ],
    },
  },
  {
    label: "Failure",
    testId: "reference-update-toast-failure",
    toast: {
      message: "アップデートに失敗しました。現在のバージョンを引き続き使用します。",
      persistent: true,
      variant: "update",
      actions: [
        { label: "もう一度確認", onClick: () => {} },
        { label: "閉じる", onClick: () => {} },
      ],
    },
  },
] satisfies Array<{ label: string; testId: string; toast: ToastData }>;

export function UpdateToastStabilitySpecimen() {
  return (
    <SurfaceCard title="Update Toast stability" variant="section" tone="subtle">
      <div className="space-y-4" data-testid="reference-update-toast-stability">
        <AnnotatedNote
          title="Stable update notification width"
          body="Download progress and restart-ready notifications share the same update Toast width so progress text changes do not resize the popup."
        />
        <div className="grid gap-4 xl:grid-cols-4">
          {updateToastSpecimens.map((specimen) => (
            <div key={specimen.testId} className="space-y-2">
              <div className="text-[11px] font-medium tracking-[0.14em] text-foreground-soft uppercase">
                {specimen.label}
              </div>
              <AppToastView
                toastMessage={specimen.toast}
                onClose={() => {}}
                position="static"
                testId={specimen.testId}
              />
            </div>
          ))}
        </div>
      </div>
    </SurfaceCard>
  );
}

export function MotionTransitionsSpecimen() {
  const [expanded, setExpanded] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <SurfaceCard variant="section">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SectionHeading>Motion surfaces</SectionHeading>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setExpanded((value) => !value)}>
            Resize
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPopupOpen((value) => !value)}>
            Popup
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDialogOpen((value) => !value)}>
            Dialog
          </Button>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="rounded-md border border-border/70 bg-background/70 p-4">
          <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-foreground/72">Resize surface</div>
          <div
            className={cn(
              "motion-resize-surface overflow-hidden rounded-md border border-border bg-surface-2 shadow-elevation-1",
              expanded ? "h-[168px] max-w-[360px]" : "h-[112px] max-w-[250px]",
            )}
          >
            <div className="flex h-full min-w-[250px] flex-col justify-between p-4">
              <div>
                <div className="mb-1 text-sm font-medium text-foreground">Account pane</div>
                <p className="max-w-[18rem] font-serif text-xs leading-[1.45] text-foreground/72">
                  Width and height changes share the same measured desktop rhythm.
                </p>
              </div>
              <div className="flex gap-2">
                <span className="h-1.5 w-16 rounded-full bg-primary/45" />
                <span className="h-1.5 w-10 rounded-full bg-border-strong/45" />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-border/70 bg-background/70 p-4">
          <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-foreground/72">Popup surface</div>
          <Button size="sm" variant="outline" aria-expanded={popupOpen}>
            Feed
          </Button>
          <div
            data-side="bottom"
            {...(popupOpen ? { "data-open": "" } : { "data-closed": "" })}
            className={cn(contextMenuStyles.popup, "mt-3 w-[220px]")}
          >
            <div className={contextMenuStyles.item}>Edit...</div>
            <div className={contextMenuStyles.item}>Open site</div>
            <div className={contextMenuStyles.item}>Mark all as read</div>
            <div className={contextMenuStyles.separator} />
            <div className="px-3 py-1 text-xs font-medium text-foreground-soft">Display mode</div>
            <div className={contextMenuStyles.item}>
              <span className="mr-2 inline-flex w-4 justify-center">
                <Check className="h-3 w-3" />
              </span>
              Preview
            </div>
          </div>
        </div>

        <div className="rounded-md border border-border/70 bg-background/70 p-4">
          <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-foreground/72">Dialog and popover</div>
          <div className="relative h-[210px] overflow-hidden rounded-md border border-border/70 bg-surface-1/80">
            <div
              className="motion-popup-overlay absolute inset-0 bg-dialog-overlay bg-dialog-scrim"
              {...(dialogOpen ? { "data-open": "" } : { "data-closed": "" })}
            />
            <div
              role="dialog"
              aria-label="Motion specimen dialog"
              className="motion-popup-dialog absolute top-1/2 left-1/2 grid w-[230px] gap-3 rounded-xl border border-border bg-surface-2 p-4 text-sm text-popover-foreground shadow-elevation-3"
              {...(dialogOpen ? { "data-open": "" } : { "data-closed": "" })}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
                  <Clock3 className="h-4 w-4 text-primary" />
                </span>
                <div className="font-medium">Sync complete</div>
              </div>
              <p className="font-serif text-xs leading-[1.45] text-foreground/62">
                Dialog motion stays centered and quieter than the surrounding chrome.
              </p>
            </div>
            <div
              data-side="top"
              {...(popupOpen ? { "data-open": "" } : { "data-closed": "" })}
              className="motion-popup-surface absolute right-4 bottom-4 rounded-md border border-border/70 bg-surface-1/96 px-2 py-1 text-xs text-foreground shadow-elevation-1"
            >
              Copy link
            </div>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
