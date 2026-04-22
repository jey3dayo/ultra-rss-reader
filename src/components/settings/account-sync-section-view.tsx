import type { AccountSelectRowProps, AccountSyncSectionViewProps } from "@/components/settings/account-detail.types";
import { SettingsSection } from "@/components/settings/settings-section";
import { LabelChip } from "@/components/shared/label-chip";
import { LabeledSelectRow } from "@/components/shared/labeled-select-row";
import { LabeledSwitchRow } from "@/components/shared/labeled-switch-row";
import { LoadingButton } from "@/components/shared/loading-button";
import { cn } from "@/lib/utils";

const CONTROL_RAIL_CLASS = "ml-auto w-full max-w-[30rem]";

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
  const progressPercent = progressValue != null ? Math.round(Math.min(progressValue, 100)) : null;

  return (
    <SettingsSection heading={heading} note={note} surface="flat" className="mb-6 sm:mb-7">
      {progressLabel ? (
        <div
          className={cn(
            CONTROL_RAIL_CLASS,
            "mb-4 rounded-lg border border-border/70 bg-surface-1/80 px-4 py-3.5 shadow-elevation-1",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium leading-5 text-foreground">{progressLabel}</div>
              {progressCurrentLabel ? (
                <div className="mt-1 text-xs leading-5 text-foreground-soft">{progressCurrentLabel}</div>
              ) : null}
            </div>
            {progressPercent !== null ? (
              <LabelChip tone="neutral" size="compact" className="shrink-0 bg-background/70 text-foreground">
                {progressPercent}%
              </LabelChip>
            ) : null}
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3/75"
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
            <LoadingButton
              className="h-11 w-full justify-center px-4 sm:w-auto"
              variant="outline"
              onClick={onSecondaryAction}
            >
              {secondaryActionLabel}
            </LoadingButton>
          ) : null}
          {onSyncNow ? (
            <LoadingButton
              className="h-11 w-full justify-center px-4 sm:w-auto"
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
