import { ChevronLeft, X } from "lucide-react";
import { type ComponentProps, type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  MOTION_CONTENT_SWAP_CLASS_NAME,
  MOTION_PHASE_ENTERING,
  MOTION_PHASE_STEADY,
  type MotionPhase,
} from "@/constants";
import { cn } from "@/lib/utils";
import {
  hasTauriRuntime,
  LAYER_POINTER_EVENT_CLASS_NAMES,
  shouldUseDesktopOverlayTitlebar,
  WORKSPACE_HEADER_STACKING_CLASS_NAMES,
} from "@/lib/window/window-chrome";
import { usePlatformStore } from "@/stores/platform-store";

type WorkspaceHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
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

const MAC_OVERLAY_DRAG_REGION_WIDTH = 72;
const MAC_OVERLAY_TITLE_OFFSET_PX = 24;
const layerPointerEventClassNames = LAYER_POINTER_EVENT_CLASS_NAMES;
const workspaceHeaderStackingClassNames = WORKSPACE_HEADER_STACKING_CLASS_NAMES;

const motionTextClassNames: Record<MotionTextVariant, string> = {
  eyebrow: "font-sans text-[11px] font-medium tracking-[0.18em] text-foreground-soft uppercase",
  title: "font-sans text-[1.65rem] leading-[0.96] font-normal tracking-[-0.04em] text-foreground",
  subtitle: "max-w-2xl font-serif text-[0.95rem] leading-[1.42] text-foreground-soft",
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
  const hasRuntime = hasTauriRuntime();
  const isBrowserPreview = !hasRuntime;
  const useDesktopOverlay = shouldUseDesktopOverlayTitlebar({
    platformKind,
    hasTauriRuntime: hasRuntime,
  });
  const hasBackAction = Boolean(backLabel && onBack);
  const isDesktopApp = hasRuntime;
  const useCompactDesktopHeader = isDesktopApp && !useDesktopOverlay;
  const showEyebrowInTopRow = isBrowserPreview || useCompactDesktopHeader;
  const showEyebrowInTitleGroup = isDesktopApp && !useCompactDesktopHeader;
  const contentKey = `${eyebrow}::${title}::${subtitle}`;
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
        useCompactDesktopHeader ? "py-1.5 sm:py-1.5" : "py-2 sm:py-2",
      )}
      style={{ backgroundColor: "var(--workspace-header-surface)" }}
    >
      {useDesktopOverlay ? (
        <div
          data-testid="workspace-header-drag-region"
          data-tauri-drag-region
          aria-hidden="true"
          className="absolute inset-y-0 left-0"
          style={{ width: `${MAC_OVERLAY_DRAG_REGION_WIDTH}px` }}
        />
      ) : null}
      <div
        data-testid="workspace-header-body"
        className={cn("flex flex-col", useCompactDesktopHeader ? "gap-1" : "gap-1.5")}
      >
        <div
          data-testid="workspace-header-top-row"
          className={cn(
            "relative flex items-center justify-between gap-4",
            useCompactDesktopHeader ? "min-h-4" : "min-h-5",
          )}
        >
          {useDesktopOverlay ? (
            <div
              // Keep one large drag surface across the visible top row and layer
              // interactive controls above it so the empty header area stays draggable.
              data-testid="workspace-header-top-row-drag-region"
              data-tauri-drag-region
              aria-hidden="true"
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
            {hasBackAction ? (
              isBrowserPreview ? (
                <WorkspaceHeaderActionButton aria-label={backLabel} onClick={onBack}>
                  <ChevronLeft className="size-4" />
                </WorkspaceHeaderActionButton>
              ) : null
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
        <div
          data-testid="workspace-header-title-group"
          className={cn("relative min-w-0 pb-0.5", useCompactDesktopHeader ? "space-y-0" : "space-y-0.5")}
          style={useDesktopOverlay ? { paddingLeft: `${MAC_OVERLAY_TITLE_OFFSET_PX}px` } : undefined}
        >
          {useDesktopOverlay ? (
            <div
              // Keep one large drag surface across the title block and lift the
              // back button above it so the whole passive header band can be grabbed.
              data-testid="workspace-header-title-group-drag-region"
              data-tauri-drag-region
              aria-hidden="true"
              className={cn("absolute inset-0", workspaceHeaderStackingClassNames.dragRegion)}
            />
          ) : null}
          {showEyebrowInTitleGroup ? (
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
          ) : null}
          {isDesktopApp ? (
            <div
              data-testid="workspace-header-navigation-row"
              className={cn(
                "relative flex min-w-0 items-center gap-2.5",
                workspaceHeaderStackingClassNames.passiveContent,
                useDesktopOverlay && layerPointerEventClassNames.inert,
              )}
            >
              {hasBackAction ? (
                <WorkspaceHeaderActionButton
                  className={cn(
                    "relative",
                    workspaceHeaderStackingClassNames.interactiveControl,
                    useDesktopOverlay && layerPointerEventClassNames.interactive,
                  )}
                  aria-label={backLabel}
                  onClick={onBack}
                >
                  <ChevronLeft className="size-4" />
                </WorkspaceHeaderActionButton>
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
          ) : (
            <MotionText as="h1" phase={contentMotionPhase} variant="title">
              {title}
            </MotionText>
          )}
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
        </div>
      </div>
    </div>
  );
}
