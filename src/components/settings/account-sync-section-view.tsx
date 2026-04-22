import type { AccountSelectRowProps, AccountSyncSectionViewProps } from "@/components/settings/account-detail.types";
import { SettingsSection } from "@/components/settings/settings-section";
import { LabeledSelectRow } from "@/components/shared/labeled-select-row";
import { LabeledSwitchRow } from "@/components/shared/labeled-switch-row";
import { LoadingButton } from "@/components/shared/loading-button";
import { cn } from "@/lib/utils";

export function AccountSyncSectionView({
  heading,
  note,
  progressLabel,
  progressValue,
  progressCurrentLabel,
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
      {progressLabel ? (
        <div className="mb-3 ml-auto w-full max-w-[30rem] rounded-md border border-border/60 bg-surface-1/72 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-foreground">{progressLabel}</div>
            {progressCurrentLabel ? (
              <div className="text-xs leading-5 text-foreground-soft">{progressCurrentLabel}</div>
            ) : null}
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3/80"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressValue ?? undefined}
            aria-valuetext={progressLabel}
          >
            <div
              className={cn(
                "h-full rounded-full bg-[var(--tone-loading)] transition-[width] duration-300 ease-out",
                progressValue === null && "w-2/5 animate-indeterminate",
              )}
              style={progressValue != null ? { width: `${Math.min(progressValue, 100)}%` } : undefined}
            />
          </div>
        </div>
      ) : null}
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
        <div className="mt-3 ml-auto w-full max-w-[30rem] space-y-2 rounded-md border border-border/60 bg-surface-1/72 p-3 text-sm">
          {statusRows.map((row) => (
            <div key={row.label} className="space-y-1">
              <div className="text-xs font-medium uppercase tracking-wide text-foreground-soft">{row.label}</div>
              <div className="break-words text-foreground">{row.value}</div>
            </div>
          ))}
        </div>
      ) : null}
      {(onSyncNow || onSecondaryAction) && (
        <div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end">
          {onSecondaryAction && secondaryActionLabel ? (
            <LoadingButton
              className="h-10 w-full justify-center px-4 sm:w-auto"
              variant="outline"
              onClick={onSecondaryAction}
            >
              {secondaryActionLabel}
            </LoadingButton>
          ) : null}
          {onSyncNow ? (
            <LoadingButton
              className="h-10 w-full justify-center px-4 sm:w-auto"
              onClick={onSyncNow}
              loading={isSyncing}
              loadingLabel={syncingLabel}
            >
              {syncNowLabel}
            </LoadingButton>
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
