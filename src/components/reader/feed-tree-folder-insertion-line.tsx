import { cn } from "cn";

type FeedTreeFolderInsertionLineProps = {
  visible: boolean;
  className?: string;
};

export function FeedTreeFolderInsertionLine({ visible, className }: FeedTreeFolderInsertionLineProps) {
  if (!visible) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      data-testid="feed-tree-folder-insertion-line"
      className={cn(
        "pointer-events-none absolute right-0 left-0 z-20 h-0.5 rounded-full bg-primary/85",
        "-top-px",
        className,
      )}
    />
  );
}
