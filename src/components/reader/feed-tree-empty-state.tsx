import type { FeedTreeEmptyStateProps } from "./feed-tree.types";

export function FeedTreeEmptyState(props: FeedTreeEmptyStateProps) {
  const text = props.text ?? props.message ?? props.label;
  return (
    <div
      className="px-2 py-4 text-center text-sm text-muted-foreground"
      aria-live={props.kind === "loading" ? "polite" : undefined}
    >
      {props.kind === "message" ? (
        text
      ) : props.kind === "loading" ? (
        <div className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-muted-foreground/50" aria-hidden="true" />
          <span>{text}</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={props.onAction}
          className="inline-flex min-h-11 items-center justify-center rounded-md px-3 text-muted-foreground underline decoration-muted-foreground/50 underline-offset-2 transition-colors hover:text-foreground hover:decoration-foreground/50"
        >
          {text}
        </button>
      )}
    </div>
  );
}
