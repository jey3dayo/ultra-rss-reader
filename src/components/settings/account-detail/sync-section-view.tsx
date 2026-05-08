import { SettingsLoadingActionButton } from "@/components/settings/settings-loading-action-button";
import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { LabeledSelectRow } from "@/components/shared/labeled-select-row";
import { LabeledSwitchRow } from "@/components/shared/labeled-switch-row";
import { cn } from "@/lib/utils";
import type { AccountSelectRowProps, AccountSyncSectionViewProps } from "./types";

const CONTROL_RAIL_CLASS = "ml-auto w-full max-w-[30rem]";

export function AccountSyncSectionView({
  heading,
  note,
  syncInterval,
  syncOnStartup,
  syncOnWake,
  keepReadItems,
  statusRows,
  syncNowLabel,
  syncingLabel,
  onSyncNow,
  isSyncing,
  secondaryActionLabel,
  onSecondaryAction,
}: AccountSyncSectionViewProps) {
  return (
    <SettingsSection heading={heading} note={note} surface="flat" className="mb-6 sm:mb-7">
      <AccountSelectRow control={syncInterval} />
      <LabeledSwitchRow
        label={syncOnStartup.label}
        checked={syncOnStartup.checked}
        onChange={syncOnStartup.onChange}
        disabled={syncOnStartup.disabled}
      />
      <LabeledSwitchRow
        label={syncOnWake.label}
        checked={syncOnWake.checked}
        onChange={syncOnWake.onChange}
        disabled={syncOnWake.disabled}
      />
      <AccountSelectRow control={keepReadItems} />
      {statusRows && statusRows.length > 0 ? (
        <div
          className={cn(
            CONTROL_RAIL_CLASS,
            "mt-4 rounded-lg border border-border/70 bg-surface-1/72 px-4 py-3 text-sm",
          )}
        >
          {statusRows.map((row) => (
            <div
              key={row.label}
              className="space-y-1 border-border/50 py-3 first:pt-0 last:pb-0 [&:not(:last-child)]:border-b"
            >
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-foreground-soft">
                {row.label}
              </div>
              <div className="break-words text-[13px] leading-5 text-foreground">{row.value}</div>
            </div>
          ))}
        </div>
      ) : null}
      {(onSyncNow || onSecondaryAction) && (
        <div className={cn(CONTROL_RAIL_CLASS, "flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end")}>
          {onSecondaryAction && secondaryActionLabel ? (
            <SettingsActionButton onClick={onSecondaryAction} disabled={isSyncing}>
              {secondaryActionLabel}
            </SettingsActionButton>
          ) : null}
          {onSyncNow ? (
            <SettingsLoadingActionButton onClick={onSyncNow} loading={isSyncing} loadingLabel={syncingLabel}>
              {syncNowLabel}
            </SettingsLoadingActionButton>
          ) : null}
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
      disabled={control.disabled}
    />
  );
}
