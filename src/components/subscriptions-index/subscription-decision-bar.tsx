import { cva } from "class-variance-authority";
import { Check, Pencil, Trash2, Undo2 } from "lucide-react";
import type { Ref } from "react";
import { MOTION_CONTENT_SWAP_CLASS_NAME, MOTION_DATA_PHASE_ATTRIBUTE, MOTION_PHASE_ENTERING } from "@/constants/motion";
import { DecisionButton, LabelChip, SurfaceCard, WorkspaceManagementActionButton } from "@/design-system";
import type { SubscriptionDecisionActions } from "@/lib/subscriptions/subscriptions-index";

export type SubscriptionManagementActions = {
  editLabel: string;
  deleteLabel: string;
  onEdit: () => void;
  onDelete: () => void;
};

type DecisionActionConfig = {
  key: "keep" | "edit" | "delete";
  intent: "keep" | "neutral" | "edit" | "delete";
  label: string;
  onClick: () => void;
  icon: typeof Check;
  fullWidth: boolean;
};

const decisionButtonVariants = cva("", {
  variants: {
    fullWidth: {
      true: "col-span-full",
      false: "",
    },
  },
});

// The keep and delete keys stay the same while the row is flagged, so toggling the decision keeps their DOM nodes and focus.
function buildDecisionActionConfigs(decisionActions: SubscriptionDecisionActions): DecisionActionConfig[] {
  if (decisionActions.kind === "kept") {
    return [
      {
        key: "keep",
        intent: "neutral",
        label: decisionActions.unkeepLabel,
        onClick: decisionActions.onUnkeep,
        icon: Undo2,
        fullWidth: true,
      },
      {
        key: "edit",
        intent: "edit",
        label: decisionActions.editLabel,
        onClick: decisionActions.onEdit,
        icon: Pencil,
        fullWidth: false,
      },
      {
        key: "delete",
        intent: "delete",
        label: decisionActions.deleteLabel,
        onClick: decisionActions.onDelete,
        icon: Trash2,
        fullWidth: false,
      },
    ];
  }

  return [
    {
      key: "keep",
      intent: "keep",
      label: decisionActions.keepLabel,
      onClick: decisionActions.onKeep,
      icon: Check,
      fullWidth: false,
    },
    {
      key: "delete",
      intent: "delete",
      label: decisionActions.deleteLabel,
      onClick: decisionActions.onDelete,
      icon: Trash2,
      fullWidth: false,
    },
  ];
}

type DecisionBarProps = {
  decisionActions: SubscriptionDecisionActions;
};

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

function DecisionBarButton({ action }: { action: DecisionActionConfig }) {
  const Icon = action.icon;
  const className = decisionButtonVariants({ fullWidth: action.fullWidth });

  if (action.intent === "edit") {
    return (
      <WorkspaceManagementActionButton
        intent="edit"
        label={action.label}
        className={className}
        onClick={action.onClick}
      >
        <Icon className="size-4" />
        {action.label}
      </WorkspaceManagementActionButton>
    );
  }

  return (
    <DecisionButton
      intent={action.intent}
      size="lg"
      aria-label={action.label}
      className={className}
      onClick={action.onClick}
    >
      <Icon className="size-4" />
      {action.label}
    </DecisionButton>
  );
}

export function DecisionBar({ decisionActions }: DecisionBarProps) {
  return (
    <SurfaceCard
      data-testid="subscriptions-detail-decision-bar"
      {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
      variant="section"
      tone="default"
      padding="compact"
      className={`${MOTION_CONTENT_SWAP_CLASS_NAME} mt-3 grid shrink-0 grid-cols-1 gap-2.5 rounded-md border-transparent bg-[var(--workspace-low-wire-action-surface)] px-3.5 pt-3.5 shadow-none backdrop-blur-sm sm:grid-cols-2 sm:px-4`}
    >
      {decisionActions.kind === "kept" ? (
        <KeptStatusRow chipLabel={decisionActions.keptChipLabel} effectLabel={decisionActions.keptEffectLabel} />
      ) : null}
      {buildDecisionActionConfigs(decisionActions).map((action) => (
        <DecisionBarButton key={action.key} action={action} />
      ))}
    </SurfaceCard>
  );
}

export type ManagementBarProps = {
  managementActions: SubscriptionManagementActions;
  editButtonRef: Ref<HTMLButtonElement>;
};

export function ManagementBar({ managementActions, editButtonRef }: ManagementBarProps) {
  return (
    <div
      data-testid="subscriptions-detail-management-bar"
      {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
      className={`${MOTION_CONTENT_SWAP_CLASS_NAME} mt-3 flex shrink-0 flex-wrap justify-end gap-2 border-t border-[var(--workspace-low-wire-divider)] pt-3.5`}
    >
      <WorkspaceManagementActionButton
        ref={editButtonRef}
        intent="edit"
        label={managementActions.editLabel}
        onClick={managementActions.onEdit}
      >
        <Pencil className="size-4" />
        {managementActions.editLabel}
      </WorkspaceManagementActionButton>
      <WorkspaceManagementActionButton
        intent="delete"
        label={managementActions.deleteLabel}
        onClick={managementActions.onDelete}
      >
        <Trash2 className="size-4" />
        {managementActions.deleteLabel}
      </WorkspaceManagementActionButton>
    </div>
  );
}
