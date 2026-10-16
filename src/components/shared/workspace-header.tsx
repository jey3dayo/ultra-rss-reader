import { cn } from "cn";
import { type ComponentProps, type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MOTION_PHASE_ENTERING, MOTION_PHASE_STEADY, type MotionPhase } from "@/constants";
import { usePlatformStore } from "@/stores/platform-store";
import {
  deriveWorkspaceHeaderLayout,
  WorkspaceHeaderDragRegion,
  WorkspaceHeaderTitleGroup,
  WorkspaceHeaderTopRow,
} from "./workspace-header-parts";

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

const MAC_OVERLAY_DRAG_REGION_WIDTH = 72;

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
