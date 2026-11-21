import { LoaderCircle } from "lucide-react";
import { Button } from "@/design-system";

export type SubscriptionsBulkRunStatus = {
  done: number;
  total: number;
  waitingForSync: boolean;
  stopRequested: boolean;
  labels: {
    status: (done: number, total: number) => string;
    waiting: string;
    showDetails: string;
    stop: string;
    stopping: string;
  };
  onStop: () => void;
  onShowDetails: () => void;
};

export function SubscriptionsBulkRunStatusView({ status }: { status: SubscriptionsBulkRunStatus }) {
  const { labels } = status;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <p role="status" className="flex min-w-0 items-center gap-1.5 text-sm font-medium tabular-nums text-foreground">
        <LoaderCircle className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        {labels.status(status.done, status.total)}
      </p>
      {status.waitingForSync ? <p className="text-xs text-foreground-soft">{labels.waiting}</p> : null}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Button type="button" variant="outline" className="min-h-11" onClick={status.onShowDetails}>
          {labels.showDetails}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={status.stopRequested}
          onClick={status.onStop}
        >
          {status.stopRequested ? labels.stopping : labels.stop}
        </Button>
      </div>
    </div>
  );
}
