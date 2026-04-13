import { Tooltip } from "@base-ui/react/tooltip";

export type TooltipProviderProps = {
  children: React.ReactNode;
};

export type AppTooltipProps = {
  label: string;
  children: React.ReactElement;
};

export function TooltipProvider({ children }: TooltipProviderProps) {
  return <Tooltip.Provider>{children}</Tooltip.Provider>;
}

export function AppTooltip({ label, children }: AppTooltipProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner side="bottom" sideOffset={8}>
          <Tooltip.Popup className="z-50 rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-lg">
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
