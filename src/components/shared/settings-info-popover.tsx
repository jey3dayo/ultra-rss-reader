import { Popover } from "@base-ui/react/popover";
import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import { SurfaceCard } from "@/components/shared/surface-card";
import { Button } from "@/components/ui/button";
import { MOTION_POPUP_SURFACE_CLASS_NAME } from "@/constants";
import { cn } from "@/lib/utils";
import { APP_STACKING_CLASS_NAMES } from "@/lib/window/window-chrome";

type SettingsInfoPopoverProps = {
  title: string;
  content: ReactNode;
  ariaLabel: string;
};

export function SettingsInfoPopover({ title, content, ariaLabel }: SettingsInfoPopoverProps) {
  const popupId = useId();
  const descriptionId = useId();
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={ariaLabel}
        aria-controls={open ? popupId : undefined}
        aria-describedby={open ? descriptionId : undefined}
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 rounded-md text-foreground-soft hover:bg-transparent hover:text-foreground aria-expanded:bg-surface-2 aria-expanded:hover:bg-surface-2"
          />
        }
      >
        <Info aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="top"
          align="end"
          positionMethod="fixed"
          collisionAvoidance={{ side: "flip", align: "shift" }}
          sideOffset={8}
          collisionPadding={16}
          className={APP_STACKING_CLASS_NAMES.popup}
        >
          <Popover.Popup
            id={popupId}
            initialFocus={false}
            className={cn(MOTION_POPUP_SURFACE_CLASS_NAME, "w-80 max-w-[calc(100vw-2rem)] outline-none")}
          >
            <SurfaceCard
              variant="info"
              tone="subtle"
              padding="default"
              tabIndex={0}
              className="max-h-[var(--available-height)] overflow-y-auto shadow-elevation-2 focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Popover.Title className="sr-only">{title}</Popover.Title>
              <Popover.Description
                id={descriptionId}
                render={<div />}
                className="text-sm leading-[1.5] text-foreground-soft"
              >
                {content}
              </Popover.Description>
            </SurfaceCard>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
