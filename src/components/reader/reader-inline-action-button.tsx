import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type ReaderInlineActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant: "feed" | "title";
};

const readerInlineActionButtonClassNames = {
  feed: "motion-static-hover-surface -mx-1 inline-flex items-center rounded-md px-1 py-0.5 text-[0.95rem] text-foreground-soft hover:bg-surface-1/72 hover:text-foreground",
  title:
    "motion-static-hover-surface -mx-1 -my-1 block w-[calc(100%+0.5rem)] rounded-md px-1 py-1.5 text-left hover:bg-surface-1/72",
} as const;

export const ReaderInlineActionButton = forwardRef<HTMLButtonElement, ReaderInlineActionButtonProps>(
  ({ className, type = "button", variant, ...props }, ref) => (
    <button ref={ref} type={type} className={cn(readerInlineActionButtonClassNames[variant], className)} {...props} />
  ),
);

ReaderInlineActionButton.displayName = "ReaderInlineActionButton";
