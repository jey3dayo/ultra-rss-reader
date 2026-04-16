import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

export type InputProps = InputPrimitive.Props;

function Input({ className, ...props }: InputProps) {
  return (
    <InputPrimitive
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-border bg-surface-1 px-3 py-1 text-sm text-foreground shadow-elevation-1 transition-[color,background-color,border-color,box-shadow] outline-none placeholder:text-foreground-soft selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-state-danger-border aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
