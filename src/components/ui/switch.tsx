import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative flex h-6 w-10 shrink-0 rounded-full bg-gradient-to-r from-gray-700 from-35% to-gray-200 to-65% bg-[length:6.5rem_100%] bg-[100%_0%] bg-no-repeat p-px shadow-[inset_0_1.5px_2px] shadow-gray-200 outline-1 -outline-offset-1 outline-gray-200 transition-[background-position,box-shadow] duration-[125ms] ease-[cubic-bezier(0.26,0.75,0.38,0.45)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:from-gray-500 dark:shadow-black/75 dark:outline-white/15 data-checked:bg-[0%_0%] data-checked:active:bg-gray-500 data-unchecked:active:bg-gray-100 data-disabled:cursor-not-allowed data-disabled:opacity-50 dark:data-checked:shadow-none",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none aspect-square h-full rounded-full bg-white shadow-[0_0_1px_1px,0_1px_1px,1px_2px_4px_-1px] shadow-gray-100 ring-0 transition-transform duration-150 data-checked:translate-x-4 dark:shadow-black/25"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
