import { Button } from "@/components/ui/button";
import type { FeedTreeEmptyStateProps } from "./feed-tree.types";

export function FeedTreeEmptyState(props: FeedTreeEmptyStateProps) {
  if (props.kind === "hidden") {
    return null;
  }

  const text = props.text ?? props.message ?? props.label;
  return (
    <div
      className="px-2 py-4 text-center text-sm text-foreground-soft"
      aria-live={props.kind === "loading" ? "polite" : undefined}
    >
      {props.kind === "message" ? (
        text
      ) : props.kind === "loading" ? (
        <div className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-foreground-soft/50" aria-hidden="true" />
          <span>{text}</span>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={props.onAction}
          className="min-h-11 px-3 text-foreground-soft underline decoration-foreground-soft/50 underline-offset-2 hover:bg-transparent hover:text-foreground hover:decoration-foreground/50"
        >
          {text}
        </Button>
      )}
    </div>
  );
}
