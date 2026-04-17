import { Skeleton } from "@/components/ui/skeleton";

type SidebarFeedTreeSkeletonProps = {
  label: string;
};

function SidebarFeedTreeSkeletonRow({
  inset = false,
  countWidthClassName,
}: {
  inset?: boolean;
  countWidthClassName?: string;
}) {
  return (
    <div className={inset ? "pl-6" : undefined}>
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
        <Skeleton aria-hidden="true" className="h-3.5 w-3.5 rounded-sm bg-surface-4/70" />
        <Skeleton aria-hidden="true" className="h-3.5 flex-1 max-w-[10.5rem] bg-surface-4/70" />
        <Skeleton
          aria-hidden="true"
          className={`h-3 min-w-8 rounded-full bg-surface-4/55 ${countWidthClassName ?? "w-8"}`}
        />
      </div>
    </div>
  );
}

export function SidebarFeedTreeSkeleton({ label }: SidebarFeedTreeSkeletonProps) {
  return (
    <div data-testid="sidebar-feed-tree-skeleton" role="status" aria-live="polite" className="px-2 py-2">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-1">
        <SidebarFeedTreeSkeletonRow countWidthClassName="w-7" />
        <SidebarFeedTreeSkeletonRow inset countWidthClassName="w-6" />
        <SidebarFeedTreeSkeletonRow inset countWidthClassName="w-9" />
        <SidebarFeedTreeSkeletonRow countWidthClassName="w-8" />
        <SidebarFeedTreeSkeletonRow inset countWidthClassName="w-5" />
      </div>
    </div>
  );
}
