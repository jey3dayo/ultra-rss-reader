import { Tooltip } from "@base-ui/react/tooltip";
import { MOTION_POPUP_SURFACE_CLASS_NAME } from "@/constants";
import { cn } from "@/lib/utils";

export type TooltipProviderProps = {
  children: React.ReactNode;
};

export type AppTooltipProps = {
  label: string;
  children: React.ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
};

export function TooltipProvider({ children }: TooltipProviderProps) {
  return <Tooltip.Provider>{children}</Tooltip.Provider>;
}

export function AppTooltip({ label, children, side = "bottom", align = "center", sideOffset = 8 }: AppTooltipProps) {
  return (
    <Tooltip.Root data-slot="tooltip">
      <Tooltip.Trigger data-slot="tooltip-trigger" render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner data-slot="tooltip-positioner" side={side} align={align} sideOffset={sideOffset}>
          <Tooltip.Popup
            data-slot="tooltip-popup"
            data-app-tooltip-side={side}
            className={cn(
              MOTION_POPUP_SURFACE_CLASS_NAME,
              "z-[80] rounded-md border border-border/70 bg-surface-1/96 px-2 py-1 text-xs text-foreground shadow-elevation-1",
            )}
          >
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
