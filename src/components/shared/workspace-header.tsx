import { cn } from "cn";
import { ChevronLeft, X } from "lucide-react";
import { type ComponentProps, type ReactNode, useEffect, useRef, useState } from "react";
import type { PlatformInfo } from "@/api/schemas";
import { Button } from "@/components/ui/button";
import {
  MOTION_CONTENT_SWAP_CLASS_NAME,
  MOTION_PHASE_ENTERING,
  MOTION_PHASE_STEADY,
  type MotionPhase,
  PHRASE_AWARE_TEXT_CLASS_NAME,
} from "@/constants";
import {
  hasTauriRuntime,
  LAYER_POINTER_EVENT_CLASS_NAMES,
  shouldUseDesktopOverlayTitlebar,
  WORKSPACE_HEADER_STACKING_CLASS_NAMES,
} from "@/lib/window/window-chrome";
import { usePlatformStore } from "@/stores/platform-store";

type WorkspaceHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  backLabel?: string;
  onBack?: () => void;
  closeLabel: string;
  onClose: () => void;
  actions?: ReactNode;
};

type MotionTextVariant = "eyebrow" | "title" | "subtitle";

type MotionTextProps = {
  as: "h1" | "p";
  children: ReactNode;
  phase: MotionPhase;
  variant: MotionTextVariant;
  className?: string;
  testId?: string;
};

type WorkspaceHeaderLayout = {
  hasBackAction: boolean;
  hasSubtitle: boolean;
  isBrowserPreview: boolean;
  isDesktopApp: boolean;
  showEyebrowInTopRow: boolean;
  showEyebrowInTitleGroup: boolean;
  useCompactDesktopHeader: boolean;
  useDesktopOverlay: boolean;
};

const MAC_OVERLAY_DRAG_REGION_WIDTH = 72;
const MAC_OVERLAY_TITLE_OFFSET_PX = 24;
const layerPointerEventClassNames = LAYER_POINTER_EVENT_CLASS_NAMES;
const workspaceHeaderStackingClassNames = WORKSPACE_HEADER_STACKING_CLASS_NAMES;

const motionTextClassNames: Record<MotionTextVariant, string> = {
  eyebrow: "font-sans text-[11px] font-medium tracking-[0.18em] text-foreground-soft uppercase",
  title: "font-sans text-[1.65rem] leading-[0.96] font-normal tracking-[-0.04em] text-foreground",
  subtitle: `max-w-2xl font-serif text-[0.95rem] leading-[1.42] text-foreground-soft ${PHRASE_AWARE_TEXT_CLASS_NAME}`,
};

const workspaceHeaderActionClassName =
  "rounded-md border-0 bg-transparent font-sans text-[0.8rem] font-normal text-foreground-soft shadow-none hover:bg-transparent hover:text-foreground";

type WorkspaceHeaderActionButtonProps = Omit<ComponentProps<typeof Button>, "size" | "variant"> & {
  presentation?: "icon" | "text";
};

export function WorkspaceHeaderActionButton({
  className,
  presentation = "icon",
  style,
  ...props
}: WorkspaceHeaderActionButtonProps) {
  return (
    <Button
      variant="ghost"
      size={presentation === "icon" ? "icon-sm" : "sm"}
      className={cn(
        workspaceHeaderActionClassName,
        presentation === "icon" ? "size-9 justify-center px-0" : "h-9 px-3",
        className,
      )}
      style={style}
      {...props}
    />
  );
}

function MotionText({ as: Component, children, phase, variant, className, testId }: MotionTextProps) {
  return (
    <Component
      data-testid={testId}
      data-motion-phase={phase}
      className={cn(MOTION_CONTENT_SWAP_CLASS_NAME, motionTextClassNames[variant], className)}
    >
      {children}
    </Component>
  );
}

type WorkspaceHeaderDragRegionProps = {
  testId: string;
  className?: string;
  style?: ComponentProps<"div">["style"];
};

function WorkspaceHeaderDragRegion({ testId, className, style }: WorkspaceHeaderDragRegionProps) {
  return <div data-testid={testId} data-tauri-drag-region aria-hidden="true" className={className} style={style} />;
}

type WorkspaceHeaderBackButtonProps = {
  ariaLabel?: string;
  className?: string;
  onClick?: () => void;
};

function WorkspaceHeaderBackButton({ ariaLabel, className, onClick }: WorkspaceHeaderBackButtonProps) {
  return (
    <WorkspaceHeaderActionButton aria-label={ariaLabel} onClick={onClick} className={className}>
      <ChevronLeft className="size-4" />
    </WorkspaceHeaderActionButton>
  );
}

function deriveWorkspaceHeaderLayout({
  platformKind,
  eyebrow,
  subtitle,
  backLabel,
  onBack,
}: {
  platformKind: PlatformInfo["kind"];
  eyebrow?: string;
  subtitle?: string;
  backLabel?: string;
  onBack?: () => void;
}): WorkspaceHeaderLayout {
  const hasRuntime = hasTauriRuntime();
  const isBrowserPreview = !hasRuntime;
  const useDesktopOverlay = shouldUseDesktopOverlayTitlebar({
    platformKind,
    hasTauriRuntime: hasRuntime,
  });
  const hasBackAction = Boolean(backLabel && onBack);
  const hasEyebrow = Boolean(eyebrow);
  const hasSubtitle = Boolean(subtitle);
  const isDesktopApp = hasRuntime;
  const useCompactDesktopHeader = isDesktopApp && !useDesktopOverlay;

  return {
    hasBackAction,
    hasSubtitle,
    isBrowserPreview,
    isDesktopApp,
    showEyebrowInTopRow: hasEyebrow && (isBrowserPreview || useCompactDesktopHeader),
    showEyebrowInTitleGroup: hasEyebrow && isDesktopApp && !useCompactDesktopHeader,
    useCompactDesktopHeader,
    useDesktopOverlay,
  };
}

type WorkspaceHeaderTopRowProps = {
  actions: ReactNode;
  backLabel?: string;
  closeLabel: string;
  contentMotionPhase: MotionPhase;
  eyebrow?: string;
  layout: WorkspaceHeaderLayout;
  onBack?: () => void;
  onClose: () => void;
};

function WorkspaceHeaderTopRow({
  actions,
  backLabel,
  closeLabel,
  contentMotionPhase,
  eyebrow,
  layout,
  onBack,
  onClose,
}: WorkspaceHeaderTopRowProps) {
  const {
    hasBackAction,
    isBrowserPreview,
    isDesktopApp,
    showEyebrowInTopRow,
    useCompactDesktopHeader,
    useDesktopOverlay,
  } = layout;

  return (
    <div
      data-testid="workspace-header-top-row"
      className={cn(
        "relative flex items-center justify-between gap-4",
        useCompactDesktopHeader ? "min-h-4" : "min-h-5",
      )}
    >
      {useDesktopOverlay ? (
        // Keep one large drag surface across the visible top row and layer
        // interactive controls above it so the empty header area stays draggable.
        <WorkspaceHeaderDragRegion
          testId="workspace-header-top-row-drag-region"
          className={cn("absolute inset-0", workspaceHeaderStackingClassNames.dragRegion)}
        />
      ) : null}
      <div
        data-testid="workspace-header-leading"
        className={cn(
          "relative flex min-w-0 items-center gap-2",
          workspaceHeaderStackingClassNames.passiveContent,
          isDesktopApp && "flex-1",
          useDesktopOverlay && layerPointerEventClassNames.inert,
        )}
      >
        {hasBackAction && isBrowserPreview ? (
          <WorkspaceHeaderBackButton ariaLabel={backLabel} onClick={onBack} />
        ) : null}
        {showEyebrowInTopRow ? (
          <MotionText as="p" phase={contentMotionPhase} variant="eyebrow">
            {eyebrow}
          </MotionText>
        ) : null}
      </div>
      <div
        data-testid="workspace-header-actions"
        className={cn(
          "relative flex shrink-0 items-center gap-2",
          workspaceHeaderStackingClassNames.interactiveControl,
        )}
      >
        {actions}
        <WorkspaceHeaderActionButton aria-label={closeLabel} onClick={onClose}>
          <X className="size-4" />
        </WorkspaceHeaderActionButton>
      </div>
    </div>
  );
}

type WorkspaceHeaderContextRowProps = {
  contentMotionPhase: MotionPhase;
  eyebrow?: string;
  useDesktopOverlay: boolean;
};

function WorkspaceHeaderContextRow({ contentMotionPhase, eyebrow, useDesktopOverlay }: WorkspaceHeaderContextRowProps) {
  return (
    <div
      className={cn(
        "relative",
        workspaceHeaderStackingClassNames.passiveContent,
        useDesktopOverlay && layerPointerEventClassNames.inert,
      )}
    >
      <div
        data-testid="workspace-header-context-row"
        className={cn(
          "flex flex-wrap items-center gap-x-2 gap-y-0.5",
          useDesktopOverlay && layerPointerEventClassNames.inert,
        )}
      >
        <MotionText as="p" phase={contentMotionPhase} variant="eyebrow">
          {eyebrow}
        </MotionText>
      </div>
    </div>
  );
}

type WorkspaceHeaderNavigationRowProps = {
  backLabel?: string;
  contentMotionPhase: MotionPhase;
  hasBackAction: boolean;
  onBack?: () => void;
  title: string;
  useDesktopOverlay: boolean;
};

function WorkspaceHeaderNavigationRow({
  backLabel,
  contentMotionPhase,
  hasBackAction,
  onBack,
  title,
  useDesktopOverlay,
}: WorkspaceHeaderNavigationRowProps) {
  return (
    <div
      data-testid="workspace-header-navigation-row"
      className={cn(
        "relative flex min-w-0 items-center gap-2.5",
        workspaceHeaderStackingClassNames.passiveContent,
        useDesktopOverlay && layerPointerEventClassNames.inert,
      )}
    >
      {hasBackAction ? (
        <WorkspaceHeaderBackButton
          className={cn(
            "relative",
            workspaceHeaderStackingClassNames.interactiveControl,
            useDesktopOverlay && layerPointerEventClassNames.interactive,
          )}
          ariaLabel={backLabel}
          onClick={onBack}
        />
      ) : null}
      <div
        data-testid="workspace-header-title-drag-content"
        className={cn("min-w-0 flex-1", useDesktopOverlay && layerPointerEventClassNames.inert)}
      >
        <MotionText as="h1" phase={contentMotionPhase} variant="title">
          {title}
        </MotionText>
      </div>
    </div>
  );
}

type WorkspaceHeaderSubtitleProps = {
  contentMotionPhase: MotionPhase;
  subtitle?: string;
  useDesktopOverlay: boolean;
};

function WorkspaceHeaderSubtitle({ contentMotionPhase, subtitle, useDesktopOverlay }: WorkspaceHeaderSubtitleProps) {
  return (
    <div
      className={cn(
        "relative",
        workspaceHeaderStackingClassNames.passiveContent,
        useDesktopOverlay && layerPointerEventClassNames.inert,
      )}
    >
      <MotionText
        as="p"
        phase={contentMotionPhase}
        variant="subtitle"
        testId="workspace-header-subtitle-content"
        className={cn(useDesktopOverlay && layerPointerEventClassNames.inert)}
      >
        {subtitle}
      </MotionText>
    </div>
  );
}

type WorkspaceHeaderTitleGroupProps = {
  backLabel?: string;
  contentMotionPhase: MotionPhase;
  eyebrow?: string;
  layout: WorkspaceHeaderLayout;
  onBack?: () => void;
  subtitle?: string;
  title: string;
};

function WorkspaceHeaderTitleGroup({
  backLabel,
  contentMotionPhase,
  eyebrow,
  layout,
  onBack,
  subtitle,
  title,
}: WorkspaceHeaderTitleGroupProps) {
  const {
    hasBackAction,
    hasSubtitle,
    isDesktopApp,
    showEyebrowInTitleGroup,
    useCompactDesktopHeader,
    useDesktopOverlay,
  } = layout;

  return (
    <div
      data-testid="workspace-header-title-group"
      className={cn("relative min-w-0 pb-0.5", useCompactDesktopHeader ? "space-y-0" : "space-y-0.5")}
      style={useDesktopOverlay ? { paddingLeft: `${MAC_OVERLAY_TITLE_OFFSET_PX}px` } : undefined}
    >
      {useDesktopOverlay ? (
        // Keep one large drag surface across the title block and lift the
        // back button above it so the whole passive header band can be grabbed.
        <WorkspaceHeaderDragRegion
          testId="workspace-header-title-group-drag-region"
          className={cn("absolute inset-0", workspaceHeaderStackingClassNames.dragRegion)}
        />
      ) : null}
      {showEyebrowInTitleGroup ? (
        <WorkspaceHeaderContextRow
          contentMotionPhase={contentMotionPhase}
          eyebrow={eyebrow}
          useDesktopOverlay={useDesktopOverlay}
        />
      ) : null}
      {isDesktopApp ? (
        <WorkspaceHeaderNavigationRow
          backLabel={backLabel}
          contentMotionPhase={contentMotionPhase}
          hasBackAction={hasBackAction}
          onBack={onBack}
          title={title}
          useDesktopOverlay={useDesktopOverlay}
        />
      ) : (
        <MotionText as="h1" phase={contentMotionPhase} variant="title">
          {title}
        </MotionText>
      )}
      {hasSubtitle ? (
        <WorkspaceHeaderSubtitle
          contentMotionPhase={contentMotionPhase}
          subtitle={subtitle}
          useDesktopOverlay={useDesktopOverlay}
        />
      ) : null}
    </div>
  );
}

export function WorkspaceHeader({
  eyebrow,
  title,
  subtitle,
  backLabel,
  onBack,
  closeLabel,
  onClose,
  actions = null,
}: WorkspaceHeaderProps) {
  const platformKind = usePlatformStore((state) => state.platform.kind);
  const layout = deriveWorkspaceHeaderLayout({ platformKind, eyebrow, subtitle, backLabel, onBack });
  const contentKey = `${eyebrow ?? ""}::${title}::${subtitle ?? ""}`;
  const previousContentKeyRef = useRef(contentKey);
  const [contentMotionPhase, setContentMotionPhase] = useState<MotionPhase>(MOTION_PHASE_STEADY);

  useEffect(() => {
    if (previousContentKeyRef.current === contentKey) {
      return;
    }

    previousContentKeyRef.current = contentKey;
    setContentMotionPhase(MOTION_PHASE_ENTERING);

    let resetHandle = 0;
    const frameHandle = requestAnimationFrame(() => {
      resetHandle = requestAnimationFrame(() => {
        setContentMotionPhase(MOTION_PHASE_STEADY);
      });
    });

    return () => {
      cancelAnimationFrame(frameHandle);
      cancelAnimationFrame(resetHandle);
    };
  }, [contentKey]);

  return (
    <div
      className={cn(
        "relative border-b border-border/70 px-5 backdrop-blur-sm sm:px-6",
        layout.useCompactDesktopHeader ? "py-1.5 sm:py-1.5" : "py-2 sm:py-2",
      )}
      style={{ backgroundColor: "var(--workspace-header-surface)" }}
    >
      {layout.useDesktopOverlay ? (
        <WorkspaceHeaderDragRegion
          testId="workspace-header-drag-region"
          className="absolute inset-y-0 left-0"
          style={{ width: `${MAC_OVERLAY_DRAG_REGION_WIDTH}px` }}
        />
      ) : null}
      <div
        data-testid="workspace-header-body"
        className={cn("flex flex-col", layout.useCompactDesktopHeader ? "gap-1" : "gap-1.5")}
      >
        <WorkspaceHeaderTopRow
          actions={actions}
          backLabel={backLabel}
          closeLabel={closeLabel}
          contentMotionPhase={contentMotionPhase}
          eyebrow={eyebrow}
          layout={layout}
          onBack={onBack}
          onClose={onClose}
        />
        <WorkspaceHeaderTitleGroup
          backLabel={backLabel}
          contentMotionPhase={contentMotionPhase}
          eyebrow={eyebrow}
          layout={layout}
          onBack={onBack}
          subtitle={subtitle}
          title={title}
        />
      </div>
    </div>
  );
}
