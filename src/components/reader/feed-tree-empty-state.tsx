import type { FeedTreeEmptyStateProps } from "./feed-tree.types";

export function FeedTreeEmptyState(props: FeedTreeEmptyStateProps) {
  return (
    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
      {props.kind === "message" ? (
        props.message
      ) : (
        <button
          type="button"
          onClick={props.onAction}
          className="inline-flex min-h-11 items-center justify-center rounded-md px-3 text-muted-foreground underline decoration-muted-foreground/50 underline-offset-2 transition-colors hover:text-foreground hover:decoration-foreground/50"
        >
          {props.label}
        </button>
      )}
    </div>
  );
}
