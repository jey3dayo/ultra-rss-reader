export const contextMenuStyles = {
  positioner: "z-50",
  popup:
    "motion-popup-surface min-w-[200px] rounded-2xl border border-border/75 bg-popover p-1.5 text-sm font-normal text-popover-foreground shadow-elevation-3 outline-none",
  item: "flex min-h-11 w-full cursor-default items-center rounded-md px-3 py-1.5 outline-none data-disabled:pointer-events-none data-disabled:text-foreground-soft data-highlighted:bg-surface-1/88 data-highlighted:text-foreground [&_svg]:text-foreground-soft",
  destructiveItem:
    "flex min-h-11 w-full cursor-default items-center rounded-md px-3 py-1.5 text-state-danger-foreground outline-none data-disabled:pointer-events-none data-disabled:opacity-60 data-highlighted:bg-state-danger-surface",
  separator: "my-1 h-px bg-border",
};
