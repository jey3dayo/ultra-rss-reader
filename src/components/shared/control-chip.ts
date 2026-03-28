import { cva } from "class-variance-authority";

export const controlChipVariants = cva(
  "inline-flex items-center gap-1 rounded-md font-medium transition-colors text-muted-foreground",
  {
    variants: {
      size: {
        compact: "px-2.5 py-1 text-xs",
        comfortable: "h-7 px-2.5 text-sm",
      },
      interaction: {
        toggle: "hover:text-foreground data-[pressed]:bg-muted data-[pressed]:text-foreground",
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
      comfortable: "h-4 w-4",
    },
  },
  defaultVariants: {
    size: "compact",
  },
});
