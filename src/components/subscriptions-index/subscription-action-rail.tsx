import { cva } from "class-variance-authority";
import { Check, Pencil, Trash2, Undo2 } from "lucide-react";
import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import { MOTION_CONTENT_SWAP_CLASS_NAME, MOTION_DATA_PHASE_ATTRIBUTE, MOTION_PHASE_ENTERING } from "@/constants/motion";
import { DecisionButton, LabelChip, SurfaceCard, WorkspaceManagementActionButton } from "@/design-system";
import type { SubscriptionActionRail as SubscriptionActionRailModel } from "@/lib/subscriptions/subscriptions-index";

const railButtonVariants = cva("", {
  variants: {
    fullWidth: {
      true: "col-span-full",
      false: "",
    },
  },
});

const DECISION_PRESENTATION = {
  keep: { intent: "keep", Icon: Check },
  unkeep: { intent: "neutral", Icon: Undo2 },
} as const;

function KeptStatusRow({ chipLabel, effectLabel }: { chipLabel: string; effectLabel: string }) {
  return (
    <div
      data-testid="subscriptions-detail-kept-status"
      className="col-span-full flex flex-wrap items-center gap-x-2 gap-y-1"
    >
      <LabelChip tone="neutral" size="compact">
        {chipLabel}
      </LabelChip>
      <p className="min-w-0 text-xs text-foreground-soft">{effectLabel}</p>
    </div>
  );
}

/**
 * A decision click arms this handoff so the rail mounted for the repaired
 * selection can take over focus. It is armed on every decision click and
 * consumed by the next rail mount; when the row stays put, the decision
 * change below disarms it instead.
 */
export type SubscriptionRailFocusHandoff = {
  fromFeedId: string;
  focusWasInRail: boolean;
};

export type SubscriptionActionRailProps = {
  actionRail: SubscriptionActionRailModel;
  feedId: string;
  focusHandoffRef: RefObject<SubscriptionRailFocusHandoff | null>;
};

// Every child keeps a fixed key and component type across states, so the edit button keeps its DOM node and focus.
export function SubscriptionActionRail({ actionRail, feedId, focusHandoffRef }: SubscriptionActionRailProps) {
  const { decision } = actionRail;
  const decisionRef = useRef<HTMLButtonElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const presentation = decision ? DECISION_PRESENTATION[decision.kind] : null;
  const decisionKind = decision?.kind ?? null;
  const previousDecisionKindRef = useRef(decisionKind);

  // When a decision removes the selected row, selection repair mounts a rail
  // for the next row. Take focus over only when the click came from a focused
  // rail and nothing else has claimed focus since (a live focus target means
  // the user has already moved on, e.g. to the filter bar after emptying the
  // list). The target is the same role: the decision button when the new row
  // has one, otherwise the edit button.
  useLayoutEffect(() => {
    const handoff = focusHandoffRef.current;
    if (!handoff) {
      return;
    }
    focusHandoffRef.current = null;
    if (!handoff.focusWasInRail || handoff.fromFeedId === feedId) {
      return;
    }
    const activeElement = document.activeElement;
    if (activeElement !== null && activeElement !== document.body) {
      return;
    }
    (decisionRef.current ?? editRef.current)?.focus();
  }, [feedId, focusHandoffRef]);

  // A decision that keeps the row selected flips the decision in place
  // (keep <-> unkeep, or the decision disappears). That settles the click, so
  // the armed handoff must not leak into a later, unrelated rail mount.
  useEffect(() => {
    if (previousDecisionKindRef.current === decisionKind) {
      return;
    }
    previousDecisionKindRef.current = decisionKind;
    if (focusHandoffRef.current?.fromFeedId === feedId) {
      focusHandoffRef.current = null;
    }
  }, [decisionKind, feedId, focusHandoffRef]);

  const handleDecisionClick = () => {
    if (!decision) {
      return;
    }
    // Record focus before the evacuation below moves it: the handoff only
    // applies when the decision was driven from a focused rail.
    const activeElement = document.activeElement;
    focusHandoffRef.current = {
      fromFeedId: feedId,
      focusWasInRail:
        activeElement !== null &&
        (activeElement === decisionRef.current ||
          activeElement === editRef.current ||
          activeElement === deleteRef.current),
    };
    if (!decision.remainsAfterClick) {
      editRef.current?.focus();
    }
    decision.onClick();
  };

  return (
    <SurfaceCard
      data-testid="subscriptions-detail-action-rail"
      {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
      variant="section"
      tone="default"
      padding="compact"
      className={`${MOTION_CONTENT_SWAP_CLASS_NAME} mt-3 grid shrink-0 grid-cols-2 gap-2.5 rounded-md border-transparent bg-[var(--workspace-low-wire-action-surface)] px-3.5 pt-3.5 shadow-none backdrop-blur-sm sm:px-4`}
    >
      {decision?.kind === "unkeep" ? (
        <KeptStatusRow key="kept-status" chipLabel={decision.keptChipLabel} effectLabel={decision.keptEffectLabel} />
      ) : null}
      {decision && presentation ? (
        <DecisionButton
          key="decision"
          ref={decisionRef}
          intent={presentation.intent}
          size="lg"
          aria-label={decision.label}
          className={railButtonVariants({ fullWidth: true })}
          onClick={handleDecisionClick}
        >
          <presentation.Icon className="size-4" />
          {decision.label}
        </DecisionButton>
      ) : null}
      <WorkspaceManagementActionButton
        key="edit"
        ref={editRef}
        intent="edit"
        label={actionRail.editLabel}
        className={railButtonVariants({ fullWidth: false })}
        onClick={actionRail.onEdit}
      >
        <Pencil className="size-4" />
        {actionRail.editLabel}
      </WorkspaceManagementActionButton>
      <WorkspaceManagementActionButton
        key="delete"
        ref={deleteRef}
        intent="delete"
        label={actionRail.deleteLabel}
        className={railButtonVariants({ fullWidth: false })}
        onClick={actionRail.onDelete}
      >
        <Trash2 className="size-4" />
        {actionRail.deleteLabel}
      </WorkspaceManagementActionButton>
    </SurfaceCard>
  );
}
