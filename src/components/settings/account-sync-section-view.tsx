import type { AccountSelectRowProps, AccountSyncSectionViewProps } from "@/components/settings/account-detail.types";
import { SettingsSection } from "@/components/settings/settings-section";
import { LabeledSelectRow } from "@/components/shared/labeled-select-row";
import { LabeledSwitchRow } from "@/components/shared/labeled-switch-row";
import { LoadingButton } from "@/components/shared/loading-button";

export function AccountSyncSectionView({
  heading,
  syncInterval,
  syncOnStartup,
  syncOnWake,
  keepReadItems,
  statusRows,
  syncNowLabel,
  syncingLabel,
  onSyncNow,
  isSyncing,
}: AccountSyncSectionViewProps) {
  return (
    <SettingsSection heading={heading} surface="flat" className="mb-6 sm:mb-7">
      <AccountSelectRow control={syncInterval} />
      <LabeledSwitchRow label={syncOnStartup.label} checked={syncOnStartup.checked} onChange={syncOnStartup.onChange} />
      <LabeledSwitchRow label={syncOnWake.label} checked={syncOnWake.checked} onChange={syncOnWake.onChange} />
      <AccountSelectRow control={keepReadItems} />
      {statusRows && statusRows.length > 0 ? (
        <div className="mt-3 space-y-2 rounded-md border border-border/60 bg-surface-1/72 p-3 text-sm">
          {statusRows.map((row) => (
            <div key={row.label} className="space-y-1">
              <div className="text-xs font-medium uppercase tracking-wide text-foreground-soft">{row.label}</div>
              <div className="break-words text-foreground">{row.value}</div>
            </div>
          ))}
        </div>
      ) : null}
      {onSyncNow && (
        <div className="pt-3">
          <LoadingButton
            size="sm"
            className="w-full justify-center sm:w-auto"
            onClick={onSyncNow}
            loading={isSyncing}
            loadingLabel={syncingLabel}
          >
            {syncNowLabel}
          </LoadingButton>
        </div>
      )}
    </SettingsSection>
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
