import { Skeleton } from "@/design-system";

const SKELETON_ROW_META_WIDTH_CLASS_NAMES = ["w-20", "w-16", "w-24", "w-14", "w-20", "w-16", "w-24"];

function ArticleListSkeletonRow({ metaWidthClassName }: { metaWidthClassName: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md px-4 py-3">
      <div className="flex items-start gap-2">
        <Skeleton aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-surface-4/70" />
        <Skeleton aria-hidden="true" className="h-3.5 flex-1 max-w-[26rem] bg-surface-4/70" />
      </div>
      <Skeleton aria-hidden="true" className={`h-3 ml-4 bg-surface-4/55 ${metaWidthClassName}`} />
    </div>
  );
}

export function ArticleListSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="article-list-skeleton"
      className="rounded-md border border-border/70 bg-surface-1/72 px-2 py-2 text-foreground-soft"
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-1">
        {SKELETON_ROW_META_WIDTH_CLASS_NAMES.map((metaWidthClassName, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder rows with no stable identity
          <ArticleListSkeletonRow key={index} metaWidthClassName={metaWidthClassName} />
        ))}
      </div>
    </div>
  );
}
