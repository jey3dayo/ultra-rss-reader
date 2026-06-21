import { Check, ChevronLeft, Clock3, ExternalLink, Plus, RefreshCw, Save, Share, Trash2, X } from "lucide-react";
import { type CSSProperties, useEffect, useReducer, useState } from "react";
import { AccountSwitcherTriggerButton } from "@/components/reader/account-switcher-view";
import { TagOptionRowButton, TagPickerTriggerButton } from "@/components/reader/article-tag-picker-buttons";
import { ArticleToolbarActionStrip } from "@/components/reader/article-toolbar-view";
import { SettingsLoadingActionButton } from "@/components/settings/settings-loading-action-button";
import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import { ShortcutKeyButton } from "@/components/settings/shortcuts-settings-view";
import {
  ArticleFilterToggleButton,
  Button,
  DecisionButton,
  DeleteButton,
  denseDecisionButtonClassName,
  FormActionButtons,
  IconToolbarButton,
  IconToolbarMenuTrigger,
  IconToolbarSurfaceButton,
  Menu,
  SectionHeading,
  SurfaceCard,
  TAG_COLOR_PRESETS,
  TagChip,
  TagColorPicker,
  TooltipProvider,
  WorkspaceHeaderActionButton,
} from "@/design-system";
import { useUiStore } from "@/stores/ui-store";

export {
  UI_REFERENCE_DECORATIVE_TEST_IDS,
  UI_REFERENCE_PRIMARY_SPECIMEN_ANCHOR_IDS,
} from "./ui-reference-canvas-specimen-ids";
export { AnnotatedNote, ReferencePage } from "./ui-reference-canvas-specimens";
export { NavigationButtonPatternsSpecimen } from "./ui-reference-navigation-specimens";

type CssVariableProperties = CSSProperties & Record<`--${string}`, string>;

type ReaderHeaderActionStripState = {
  isRead: boolean;
  isStarred: boolean;
  isBrowserOpen: boolean;
};

type ReaderHeaderActionStripAction =
  | {
      type: "set-read";
      value: boolean;
    }
  | {
      type: "set-starred";
      value: boolean;
    }
  | {
      type: "toggle-browser-open";
    };

function readerHeaderActionStripReducer(
  state: ReaderHeaderActionStripState,
  action: ReaderHeaderActionStripAction,
): ReaderHeaderActionStripState {
  switch (action.type) {
    case "set-read":
      return { ...state, isRead: action.value };
    case "set-starred":
      return { ...state, isStarred: action.value };
    case "toggle-browser-open":
      return { ...state, isBrowserOpen: !state.isBrowserOpen };
  }
}

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
                  <Save className="size-4" />
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
                <RefreshCw className="size-4" />
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
              <X className="size-4" />
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
          <Check className="size-4" />
          Keep selected
        </DecisionButton>
        <DecisionButton intent="defer" className={denseDecisionButtonClassName} aria-label="Defer selected">
          <Clock3 className="size-4" />
          Defer selected
        </DecisionButton>
        <DecisionButton intent="delete" className={denseDecisionButtonClassName} aria-label="Delete selected">
          <Trash2 className="size-4" />
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
                <RefreshCw className="size-4" />
              </IconToolbarButton>
              <IconToolbarButton label="Open in browser" ariaPressed onClick={() => undefined}>
                <ExternalLink className="size-4" />
              </IconToolbarButton>
            </div>
          </div>
          <div className="rounded-md border border-border/60 bg-surface-1/70 p-3">
            <div className="mb-2 text-[11px] font-medium tracking-[0.14em] text-foreground-soft uppercase">
              Overlay surface
            </div>
            <div className="flex items-center gap-2">
              <IconToolbarSurfaceButton label="Close Web Preview" onClick={() => undefined}>
                <X className="size-4" />
              </IconToolbarSurfaceButton>
            </div>
          </div>
          <div
            data-testid="reference-browser-chrome-buttons"
            className="rounded-md border border-border/60 bg-[#1e2324] p-3 text-[#f2f1ed]"
            style={darkReaderToolbarTokens}
          >
            <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-medium tracking-[0.14em] text-[#f2f1ed]/60 uppercase">
              <span>Browser chrome</span>
              <span>40px target / 20px icon</span>
            </div>
            <div className="flex min-h-10 items-center gap-3">
              <IconToolbarSurfaceButton label="Browser chrome close" variant="chrome" onClick={() => undefined}>
                <X className="size-5" />
              </IconToolbarSurfaceButton>
              <IconToolbarSurfaceButton label="Browser chrome back" variant="chrome" onClick={() => undefined}>
                <ChevronLeft className="size-5" />
              </IconToolbarSurfaceButton>
              <IconToolbarSurfaceButton label="Browser chrome reload" variant="chrome" onClick={() => undefined}>
                <RefreshCw className="size-5" />
              </IconToolbarSurfaceButton>
              <IconToolbarSurfaceButton
                label="Browser chrome external"
                variant="chrome"
                tooltipSide="left"
                onClick={() => undefined}
              >
                <ExternalLink className="size-5" />
              </IconToolbarSurfaceButton>
            </div>
          </div>
          <div className="rounded-md border border-border/60 bg-surface-1/70 p-3">
            <div className="mb-2 text-[11px] font-medium tracking-[0.14em] text-foreground-soft uppercase">
              Workspace header
            </div>
            <div className="flex items-center gap-2">
              <WorkspaceHeaderActionButton aria-label="Close workspace">
                <X className="size-4" />
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
  const [lightArticleState, dispatchLightArticleState] = useReducer(readerHeaderActionStripReducer, {
    isRead: false,
    isStarred: true,
    isBrowserOpen: false,
  });
  const [darkArticleState, dispatchDarkArticleState] = useReducer(readerHeaderActionStripReducer, {
    isRead: false,
    isStarred: true,
    isBrowserOpen: true,
  });

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
              articleState={{
                hasArticle: true,
                ...lightArticleState,
              }}
              actionOptions={{
                canToggleRead: true,
                canToggleStar: true,
                showCopyLinkButton: true,
                canCopyLink: true,
                showOpenInBrowserButton: true,
                canOpenInBrowser: true,
                showOpenInExternalBrowserButton: true,
                canOpenInExternalBrowser: true,
              }}
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
              onToggleRead={(value) => dispatchLightArticleState({ type: "set-read", value })}
              onToggleStar={(value) => dispatchLightArticleState({ type: "set-starred", value })}
              onCopyLink={() => undefined}
              onOpenInBrowser={() => dispatchLightArticleState({ type: "toggle-browser-open" })}
              onOpenInExternalBrowser={() => undefined}
              shareMenuControl={
                <Menu.Root>
                  <IconToolbarMenuTrigger label="Share">
                    <Share className="size-4" />
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
              articleState={{
                hasArticle: true,
                ...darkArticleState,
              }}
              actionOptions={{
                canToggleRead: true,
                canToggleStar: true,
                showCopyLinkButton: true,
                canCopyLink: true,
                showOpenInBrowserButton: true,
                canOpenInBrowser: true,
                showOpenInExternalBrowserButton: true,
                canOpenInExternalBrowser: true,
              }}
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
              onToggleRead={(value) => dispatchDarkArticleState({ type: "set-read", value })}
              onToggleStar={(value) => dispatchDarkArticleState({ type: "set-starred", value })}
              onCopyLink={() => undefined}
              onOpenInBrowser={() => dispatchDarkArticleState({ type: "toggle-browser-open" })}
              onOpenInExternalBrowser={() => undefined}
              shareMenuControl={
                <Menu.Root>
                  <IconToolbarMenuTrigger label="Share">
                    <Share className="size-4" />
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
              <Plus className="size-3" aria-hidden="true" />
              <span>Add tag</span>
            </TagPickerTriggerButton>
            <TagPickerTriggerButton compact aria-label="Add compact tag">
              <Plus className="size-3" aria-hidden="true" />
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
