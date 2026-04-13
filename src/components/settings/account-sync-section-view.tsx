import type { AccountSelectRowProps, AccountSyncSectionViewProps } from "@/components/settings/account-detail.types";
import { LabeledSelectRow } from "@/components/shared/labeled-select-row";
import { LabeledSwitchRow } from "@/components/shared/labeled-switch-row";
import { LoadingButton } from "@/components/shared/loading-button";
import { SectionHeading } from "@/components/shared/section-heading";

export function AccountSyncSectionView({
  heading,
  syncInterval,
  syncOnWake,
  keepReadItems,
  statusRows,
  syncNowLabel,
  syncingLabel,
  onSyncNow,
  isSyncing,
}: AccountSyncSectionViewProps) {
  return (
    <section className="mb-6">
      <SectionHeading>{heading}</SectionHeading>
      <AccountSelectRow control={syncInterval} />
      <LabeledSwitchRow label={syncOnWake.label} checked={syncOnWake.checked} onChange={syncOnWake.onChange} />
      <AccountSelectRow control={keepReadItems} />
      {statusRows && statusRows.length > 0 ? (
        <div className="mt-3 space-y-2 rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
          {statusRows.map((row) => (
            <div key={row.label} className="space-y-1">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{row.label}</div>
              <div className="break-words text-foreground">{row.value}</div>
            </div>
          ))}
        </div>
      ) : null}
      {onSyncNow && (
        <div className="pt-3">
          <LoadingButton size="sm" onClick={onSyncNow} loading={isSyncing} loadingLabel={syncingLabel}>
            {syncNowLabel}
          </LoadingButton>
        </div>
      )}
    </section>
  );
}

function AccountSelectRow({ control }: AccountSelectRowProps) {
  return (
    <LabeledSelectRow
      label={control.label}
      name={control.name}
      value={control.value}
      options={control.options}
      onChange={control.onChange}
    />
  );
}
