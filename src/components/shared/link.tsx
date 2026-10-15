import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps } from "react";

const linkVariants = cva("", {
  variants: {
    variant: {
      subtle:
        "underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
      detail:
        "inline-flex items-center gap-1 cursor-pointer text-foreground-soft underline decoration-border underline-offset-4 transition-colors duration-150 ease-standard hover:text-foreground motion-reduce:transition-none",
    },
  },
  defaultVariants: {
    variant: "subtle",
  },
});

type LinkProps = ComponentProps<"a"> & VariantProps<typeof linkVariants>;

export function Link({ variant, className, ...props }: LinkProps) {
  return <a data-link={variant ?? "subtle"} className={cn(linkVariants({ variant }), className)} {...props} />;
}
