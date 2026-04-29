import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const readerPassiveCardClassName =
  "rounded-3xl border border-border/80 bg-card/38 shadow-none dark:border-border/90 dark:bg-card/38 dark:shadow-none";

export const readerPassiveCardOffsetClassName = "-translate-y-[14%] md:-translate-y-[16%]";

export function ReaderPassiveCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(readerPassiveCardClassName, className)} {...props} />;
}
