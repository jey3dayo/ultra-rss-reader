import { Tooltip } from "@base-ui/react/tooltip";

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <Tooltip.Provider>{children}</Tooltip.Provider>;
}

export function AppTooltip({ label, children }: { label: string; children: React.ReactElement }) {
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
