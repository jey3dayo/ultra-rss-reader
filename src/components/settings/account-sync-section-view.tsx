import type { AccountSelectControl, AccountSyncSectionViewProps } from "@/components/settings/account-detail.types";
import { LabeledSelectRow } from "@/components/shared/labeled-select-row";
import { LoadingButton } from "@/components/shared/loading-button";
import { LabeledSwitchRow } from "@/components/shared/labeled-switch-row";
import { SectionHeading } from "@/components/shared/section-heading";

export function AccountSyncSectionView({
  heading,
  syncInterval,
  syncOnWake,
  keepReadItems,
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

function AccountSelectRow({ control }: { control: AccountSelectControl }) {
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
