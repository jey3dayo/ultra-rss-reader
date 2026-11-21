import { cva } from "class-variance-authority";
import { Check, Clock, LoaderCircle, Minus, Trash2, X } from "lucide-react";
import { type RefObject, useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  type BulkUnsubscribeOutcome,
  type BulkUnsubscribeRowStatus,
  type BulkUnsubscribeTarget,
  orderBulkUnsubscribeTargets,
  useBulkUnsubscribeFeeds,
} from "@/components/subscriptions-index/hooks/use-bulk-unsubscribe-feeds";
import { MOTION_HOLD_CONFIRM_CLASS_NAME, MOTION_HOLD_CONFIRM_FILL_CLASS_NAME } from "@/constants";
import {
  Button,
  DeleteButton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FeedFavicon,
  LabelChip,
  resolveHoldButtonProps,
  ScrollArea,
  SurfaceCard,
  useHoldToConfirm,
} from "@/design-system";
import { getRestorableActiveElement, restoreFocusOnMicrotask } from "@/lib/dom/focus-restore";
import { readMatchMedia } from "@/lib/runtime/match-media-listener";

export type BulkUnsubscribeDialogProps = {
  open: boolean;
  accountId: string | null;
  targets: ReadonlyArray<BulkUnsubscribeTarget>;
  onSettled: (succeededFeedIds: readonly string[]) => void;
  onClose: (outcome: { allSucceeded: boolean }) => void;
};

const ROW_STATUS_LABEL_KEYS = {
  waiting: "bulk_row_waiting",
  running: "bulk_row_running",
  done: "bulk_row_done",
  failed: "bulk_row_failed",
  skipped: "bulk_row_skipped",
} as const satisfies Record<BulkUnsubscribeRowStatus, string>;

const rowStatusVariants = cva("flex shrink-0 items-center gap-1 text-xs", {
  variants: {
    status: {
      waiting: "text-foreground-soft",
      running: "text-foreground",
      done: "text-state-success-foreground",
      failed: "text-state-danger-foreground",
      skipped: "text-foreground-soft",
    },
  },
});

function RowStatusIcon({ status }: { status: BulkUnsubscribeRowStatus }) {
  switch (status) {
    case "waiting":
      return <Clock className="size-3.5" aria-hidden="true" />;
    case "running":
      return <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />;
    case "done":
      return <Check className="size-3.5" aria-hidden="true" />;
    case "failed":
      return <X className="size-3.5" aria-hidden="true" />;
    case "skipped":
      return <Minus className="size-3.5" aria-hidden="true" />;
  }
}

function scrollRowIntoView(row: HTMLElement | null) {
  if (row === null || typeof row.scrollIntoView !== "function") {
    return;
  }
  const reducedMotion = readMatchMedia("(prefers-reduced-motion: reduce)")?.matches ?? false;
  row.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "instant" : "smooth" });
}

type BulkUnsubscribeRowProps = {
  target: BulkUnsubscribeTarget;
  status: BulkUnsubscribeRowStatus;
  reason: string | null;
  showStatus: boolean;
};

function BulkUnsubscribeRow({ target, status, reason, showStatus }: BulkUnsubscribeRowProps) {
  const { t } = useTranslation("subscriptions");
  const { feed, folderName } = target.row;

  return (
    <li
      ref={status === "running" ? scrollRowIntoView : undefined}
      data-status={showStatus ? status : undefined}
      className="flex items-start gap-2.5 px-3 py-2"
    >
      <span className="mt-0.5 flex shrink-0">
        <FeedFavicon title={feed.title} url={feed.url} siteUrl={feed.site_url} iconUrl={feed.icon_url} size="md" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{feed.title}</span>
          {target.wasKept ? (
            <LabelChip tone="warning" size="compact">
              {t("kept_chip")}
            </LabelChip>
          ) : null}
        </div>
        {folderName ? <p className="truncate text-xs text-foreground-soft">{folderName}</p> : null}
        {reason ? <p className="text-xs text-state-danger-foreground">{reason}</p> : null}
      </div>
      {showStatus ? (
        <span className={rowStatusVariants({ status })}>
          <RowStatusIcon status={status} />
          {t(ROW_STATUS_LABEL_KEYS[status])}
        </span>
      ) : null}
    </li>
  );
}

type ResultNoticeProps = {
  outcome: BulkUnsubscribeOutcome | null;
  succeededCount: number;
  failedRows: ReadonlyArray<{ feedId: string; title: string; reason: string | null }>;
  skippedCount: number;
};

function ResultNotice({ outcome, succeededCount, failedRows, skippedCount }: ResultNoticeProps) {
  const { t } = useTranslation("subscriptions");

  if (outcome === "partial") {
    return (
      <SurfaceCard variant="info" tone="danger" padding="compact" role="alert">
        <p className="text-sm">{t("bulk_result_partial", { succeeded: succeededCount, failed: failedRows.length })}</p>
        <ul className="mt-2 max-h-24 list-none space-y-1 overflow-y-auto text-xs">
          {failedRows.map((row) => (
            <li key={row.feedId}>
              {row.title}: {row.reason}
            </li>
          ))}
        </ul>
      </SurfaceCard>
    );
  }
  if (outcome === "busy") {
    return (
      <SurfaceCard variant="info" tone="warning" padding="compact" role="alert">
        <p className="text-sm">{t("bulk_result_busy", { count: skippedCount })}</p>
      </SurfaceCard>
    );
  }
  if (outcome === "cancelled") {
    return (
      <SurfaceCard variant="info" tone="subtle" padding="compact" role="status">
        <p className="text-sm">{t("bulk_result_cancelled", { succeeded: succeededCount, skipped: skippedCount })}</p>
      </SurfaceCard>
    );
  }
  return null;
}

type BulkRun = ReturnType<typeof useBulkUnsubscribeFeeds>;

const ACTION_ROW_CLASS_NAME = "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end";

type ConfirmActionsProps = {
  open: boolean;
  run: BulkRun;
  targets: ReadonlyArray<BulkUnsubscribeTarget>;
  feedCount: number;
  confirmButtonRef: RefObject<HTMLButtonElement | null>;
  onClose: BulkUnsubscribeDialogProps["onClose"];
};

// Mounted only in the confirm step, so leaving it (run start, close, unmount) tears down any pending hold timer.
function ConfirmActions({ open, run, targets, feedCount, confirmButtonRef, onClose }: ConfirmActionsProps) {
  const { t } = useTranslation("subscriptions");
  const { t: tc } = useTranslation("common");
  const holdHintId = useId();
  const { holding, cancelHold, cancelPointerHold, handlePointerDown, handleClick } = useHoldToConfirm({
    enabled: open,
    onConfirm: () => run.start(targets),
  });

  return (
    <>
      <div className={ACTION_ROW_CLASS_NAME}>
        <Button variant="outline" className="min-h-11" onClick={() => onClose({ allSucceeded: false })}>
          {tc("cancel")}
        </Button>
        <DeleteButton
          ref={confirmButtonRef}
          showIcon={false}
          className={`${MOTION_HOLD_CONFIRM_CLASS_NAME} min-h-11 touch-none select-none`}
          aria-label={t("bulk_dialog_confirm_aria", { count: feedCount })}
          aria-describedby={holdHintId}
          onClick={handleClick}
          {...resolveHoldButtonProps({ holdEnabled: true, holding, handlePointerDown, cancelPointerHold, cancelHold })}
        >
          <span
            aria-hidden="true"
            data-testid="confirm-dialog-hold-fill"
            className={MOTION_HOLD_CONFIRM_FILL_CLASS_NAME}
          />
          <Trash2 aria-hidden="true" className="relative size-3.5" />
          <span className="relative">{t("bulk_dialog_confirm", { count: feedCount })}</span>
        </DeleteButton>
      </div>
      <p id={holdHintId} className="text-right text-foreground-soft text-xs leading-relaxed">
        {tc("hold_to_confirm")}
      </p>
    </>
  );
}

function RunningActions({ run }: { run: BulkRun }) {
  const { t } = useTranslation("subscriptions");

  return (
    <div className={ACTION_ROW_CLASS_NAME}>
      <Button variant="outline" className="min-h-11" autoFocus disabled={run.stopRequested} onClick={run.stop}>
        {run.stopRequested ? t("bulk_dialog_stopping") : t("bulk_dialog_stop")}
      </Button>
    </div>
  );
}

function ResultActions({ run, onClose }: { run: BulkRun; onClose: BulkUnsubscribeDialogProps["onClose"] }) {
  const { t } = useTranslation("subscriptions");
  const { t: tc } = useTranslation("common");
  const canRetry = run.outcome === "partial" || run.outcome === "busy";

  return (
    <div className={ACTION_ROW_CLASS_NAME}>
      <Button
        variant="outline"
        className="min-h-11"
        autoFocus
        onClick={() => onClose({ allSucceeded: run.outcome === "completed" })}
      >
        {tc("close")}
      </Button>
      {canRetry ? (
        <Button variant="outline" className="min-h-11" onClick={run.retry}>
          {t("bulk_dialog_retry", { count: run.retryCount })}
        </Button>
      ) : null}
    </div>
  );
}

type BulkUnsubscribeFooterProps = ConfirmActionsProps;

function BulkUnsubscribeFooter(props: BulkUnsubscribeFooterProps) {
  const { run } = props;

  return (
    <DialogFooter className="flex-col sm:flex-col">
      {run.phase === "confirm" ? <ConfirmActions {...props} /> : null}
      {run.phase === "running" ? <RunningActions run={run} /> : null}
      {run.phase === "result" ? <ResultActions run={run} onClose={props.onClose} /> : null}
    </DialogFooter>
  );
}

export function BulkUnsubscribeDialog({ open, accountId, targets, onSettled, onClose }: BulkUnsubscribeDialogProps) {
  const { t } = useTranslation("subscriptions");
  const run = useBulkUnsubscribeFeeds({ open, accountId, onSettled, onClose });
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusElementRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      restoreFocusElementRef.current = getRestorableActiveElement();
    }
    if (!open && wasOpenRef.current) {
      restoreFocusOnMicrotask(restoreFocusElementRef.current);
    }
    wasOpenRef.current = open;
  }, [open]);

  const running = run.phase === "running";
  const displayedTargets = run.phase === "confirm" ? orderBulkUnsubscribeTargets(targets) : run.snapshot;
  const entries = displayedTargets.map((target, index) => ({
    target,
    status: run.rows[index]?.status ?? "waiting",
    reason: run.rows[index]?.reason ?? null,
  }));
  const keptEntries = entries.filter((entry) => entry.target.wasKept);
  const otherEntries = entries.filter((entry) => !entry.target.wasKept);
  const failedRows = entries
    .filter((entry) => entry.status === "failed")
    .map((entry) => ({ feedId: entry.target.row.feed.id, title: entry.target.row.feed.title, reason: entry.reason }));
  const succeededCount = entries.filter((entry) => entry.status === "done").length;
  const skippedCount = entries.filter((entry) => entry.status === "skipped").length;

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen || running || run.outcome === "completed") {
      return;
    }
    onClose({ allSucceeded: false });
  };

  const renderRow = (entry: (typeof entries)[number]) => (
    <BulkUnsubscribeRow
      key={entry.target.row.feed.id}
      target={entry.target}
      status={entry.status}
      reason={entry.reason}
      showStatus={run.phase !== "confirm"}
    />
  );

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen) {
          run.reset();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        initialFocus={run.phase === "confirm" ? confirmButtonRef : undefined}
        className="grid-cols-[minmax(0,1fr)] sm:max-w-lg"
        aria-busy={running}
      >
        <DialogHeader>
          <DialogTitle>{t("bulk_dialog_title", { count: entries.length })}</DialogTitle>
          <DialogDescription>{t("bulk_dialog_description")}</DialogDescription>
          {run.phase === "confirm" ? null : (
            <p role="status" className="text-xs text-foreground-soft tabular-nums">
              {t("bulk_dialog_progress", { done: run.settledCount, total: entries.length })}
            </p>
          )}
        </DialogHeader>
        <ScrollArea className="h-64 rounded-md border border-border/60" keyboardScrollable>
          {keptEntries.length > 0 ? (
            <section className="border-b border-state-warning-border bg-state-warning-surface">
              <h3 className="px-3 pt-2 text-xs font-medium text-state-warning-foreground">
                {t("bulk_dialog_kept_heading", { count: keptEntries.length })}
              </h3>
              <p className="px-3 text-xs text-state-warning-foreground">{t("bulk_dialog_kept_included")}</p>
              <ul className="list-none">{keptEntries.map(renderRow)}</ul>
            </section>
          ) : null}
          <ul className="list-none">{otherEntries.map(renderRow)}</ul>
        </ScrollArea>
        <ResultNotice
          outcome={run.phase === "result" ? run.outcome : null}
          succeededCount={succeededCount}
          failedRows={failedRows}
          skippedCount={skippedCount}
        />
        <BulkUnsubscribeFooter
          run={run}
          open={open}
          targets={targets}
          feedCount={entries.length}
          confirmButtonRef={confirmButtonRef}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
