import { cva } from "class-variance-authority";
import { Check, Pencil, Trash2, Undo2 } from "lucide-react";
import { useRef } from "react";
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

// Every child keeps a fixed key and component type across states, so the edit button keeps its DOM node and focus.
export function SubscriptionActionRail({ actionRail }: { actionRail: SubscriptionActionRailModel }) {
  const { decision } = actionRail;
  const editRef = useRef<HTMLButtonElement>(null);
  const presentation = decision ? DECISION_PRESENTATION[decision.kind] : null;

  const handleDecisionClick = () => {
    if (!decision) {
      return;
    }
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
