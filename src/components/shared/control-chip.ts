import { cva } from "class-variance-authority";

export const controlChipVariants = cva(
  "inline-flex items-center gap-1 rounded-md font-medium text-foreground-soft transition-colors duration-150 ease-standard motion-reduce:transition-none",
  {
    variants: {
      size: {
        compact: "px-2.5 py-1 text-xs",
        filter: "h-7 gap-1.5 rounded-md px-3 text-[13px] leading-none",
        comfortable: "h-7 px-2.5 text-sm",
        picker: "min-h-6 gap-1.5 px-2.5 pr-3 text-[12px] leading-none",
        pickerCompact: "min-h-6 gap-0 px-2 text-[12px] leading-none",
      },
      interaction: {
        toggle: "hover:text-foreground data-[pressed]:bg-surface-1/72 data-[pressed]:text-foreground",
        action: "border-0 bg-transparent hover:bg-transparent hover:text-foreground dark:hover:bg-transparent",
      },
    },
    defaultVariants: {
      size: "compact",
      interaction: "toggle",
    },
  },
);

export const controlChipIconVariants = cva("", {
  variants: {
    size: {
      compact: "h-3.5 w-3.5",
      filter: "h-3.5 w-3.5",
      comfortable: "h-4 w-4",
    },
  },
  defaultVariants: {
    size: "compact",
  },
});
