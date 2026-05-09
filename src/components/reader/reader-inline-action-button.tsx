import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ReaderInlineActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant: "feed" | "title";
};

const readerInlineActionButtonClassNames: Record<ReaderInlineActionButtonProps["variant"], string> = {
  feed: "motion-static-hover-surface -mx-1 inline-flex items-center rounded-md px-1 py-0.5 text-[0.95rem] text-foreground-soft hover:bg-surface-1/72 hover:text-foreground",
  title:
    "motion-static-hover-surface -mx-1 -my-1 block w-[calc(100%+0.5rem)] rounded-md px-1 py-1.5 text-left hover:bg-surface-1/72",
};

export function ReaderInlineActionButton({
  className,
  type = "button",
  variant,
  ...props
}: ReaderInlineActionButtonProps) {
  return <button type={type} className={cn(readerInlineActionButtonClassNames[variant], className)} {...props} />;
}
