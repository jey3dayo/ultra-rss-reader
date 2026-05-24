import { AlertTriangle, BookOpen, Check, Clock3, Palette, RefreshCw, Save, Settings2, Share } from "lucide-react";
import { type ReactNode, useState } from "react";
import { contextMenuStyles } from "@/components/reader/context-menu-styles";
import { type SettingsNavItem, SettingsNavView } from "@/components/settings/settings-nav-view";
import { AppToastView } from "@/components/shared/app-toast-view";
import { StarIcon, UnreadIcon } from "@/components/shared/article-state-icon";
import { iconToolbarButtonClassName } from "@/components/shared/icon-toolbar-control-styles";
import { SectionHeading } from "@/components/shared/section-heading";
import { SurfaceCard } from "@/components/shared/surface-card";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import type { ToastData } from "@/lib/ui/toast.types";
import { cn } from "@/lib/utils";
import { AnnotatedNote, ReferencePage } from "./ui-reference-canvas-specimens";

type MainContentShellSpecimenProps = {
  title?: string;
  subtitle?: string;
  children?: ReactNode;
};

const REFERENCE_NAV_ITEMS: SettingsNavItem[] = [
  {
    id: "general",
    label: "General",
    icon: <Settings2 className="size-4" />,
    isActive: true,
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: <Palette className="size-4" />,
    isActive: false,
  },
  {
    id: "reading",
    label: "Reading",
    icon: <BookOpen className="size-4" />,
    isActive: false,
  },
];

const SHELL_SPECIMEN_OUTER_RADIUS_CLASS = "rounded-xl";
const SHELL_SPECIMEN_INNER_RADIUS_CLASS = "rounded-lg";

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

export function ShellExamplesSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Shell examples</SectionHeading>
      <div className="grid gap-3 xl:grid-cols-3">
        <div
          className={cn(
            SHELL_SPECIMEN_OUTER_RADIUS_CLASS,
            "border border-border/60 bg-card/36 p-4 shadow-elevation-1 sm:p-5",
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
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/15">
                  <AlertTriangle className="size-5 text-primary" />
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
            "border border-border/60 bg-card/36 p-4 shadow-elevation-1 sm:p-5",
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
              className="flex items-center gap-2 rounded-lg bg-[color-mix(in_srgb,var(--foreground)_86%,var(--background))] p-3 text-[color:var(--background)]"
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
                <Clock3 className="size-4" />
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
                <UnreadIcon unread={true} className="size-2.5" />
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
                <StarIcon starred={true} className="size-4" />
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
                <Check className="size-4" />
              </Button>
            </div>
          </div>
        </div>
        <div
          className={cn(
            SHELL_SPECIMEN_OUTER_RADIUS_CLASS,
            "border border-border/60 bg-card/36 p-4 shadow-elevation-1 sm:p-5",
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
            <CommandInput aria-label="Reference command search" placeholder="Search reader actions…" />
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
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] gap-4">
          {updateToastSpecimens.map((specimen) => (
            <div key={specimen.testId} className="min-w-0 space-y-2">
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
            <div className={contextMenuStyles.item}>Edit…</div>
            <div className={contextMenuStyles.item}>Open site</div>
            <div className={contextMenuStyles.item}>Mark all as read</div>
            <div className={contextMenuStyles.separator} />
            <div className="px-3 py-1 text-xs font-medium text-foreground-soft">Display mode</div>
            <div className={contextMenuStyles.item}>
              <span className="mr-2 inline-flex w-4 justify-center">
                <Check className="size-3" />
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
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15">
                  <Clock3 className="size-4 text-primary" />
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

export { AnnotatedNote, ReferencePage };
