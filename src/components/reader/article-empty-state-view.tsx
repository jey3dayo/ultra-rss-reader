import { SurfaceCard } from "@/components/shared/surface-card";
import type { ArticleEmptyStateViewProps } from "./article-view.types";

const EMPTY_HINTS: string[] = [];

export function ArticleEmptyStateView({ message, hints = EMPTY_HINTS }: ArticleEmptyStateViewProps) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-10 text-center">
      <SurfaceCard
        variant="info"
        padding="spacious"
        className="max-w-xl border-transparent bg-transparent text-left text-foreground-soft shadow-none"
        style={{ borderColor: "transparent", backgroundColor: "transparent", boxShadow: "none" }}
      >
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
      </SurfaceCard>
    </div>
  );
}
