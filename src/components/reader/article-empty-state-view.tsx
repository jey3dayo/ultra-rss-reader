import { cn } from "@/lib/utils";
import type { ArticleEmptyStateViewProps } from "./article-view.types";

const EMPTY_HINTS: string[] = [];

export function ArticleEmptyStateView({ message, hints = EMPTY_HINTS }: ArticleEmptyStateViewProps) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-10 text-center">
      <div className={cn("max-w-xl px-7 py-7 text-left text-foreground-soft", hints.length > 0 && "min-h-44")}>
        <p className="text-left text-[1.35rem] font-semibold leading-[1.2] tracking-[-0.02em] text-foreground">
          {message}
        </p>
        {hints.length > 0 ? (
          <ul className="mt-5 list-disc space-y-2.5 border-t border-border/70 pt-5 pl-5 text-left text-sm leading-6 marker:text-foreground-soft">
            {hints.map((hint) => (
              <li key={hint} className="leading-6">
                {hint}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
