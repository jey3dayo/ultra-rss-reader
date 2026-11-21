import { Button } from "@/design-system";

export type SubscriptionsSearchCondition = {
  label: string;
  clearLabel: string;
  onClear: () => void;
};

export function SubscriptionsSearchConditionView({
  condition,
}: {
  condition: SubscriptionsSearchCondition | null | undefined;
}) {
  if (!condition) {
    return null;
  }

  return (
    <div
      data-testid="subscriptions-search-condition"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border/60 bg-surface-1/58 px-3.5 py-2.5 text-sm"
    >
      <p role="status" className="min-w-0 flex-1 text-foreground-soft">
        {condition.label}
      </p>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={condition.onClear} className="min-h-11">
          {condition.clearLabel}
        </Button>
      </div>
    </div>
  );
}
