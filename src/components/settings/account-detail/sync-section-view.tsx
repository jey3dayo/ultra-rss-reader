import { cn } from "cn";
import { SettingsLoadingActionButton } from "@/components/settings/settings-loading-action-button";
import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import {
  SETTINGS_CONTROL_SURFACE_CLASS,
  SETTINGS_DIVIDER_CLASS,
  SETTINGS_INFO_SURFACE_CLASS,
} from "@/components/settings/shared/settings-surface";
import { LabeledSelectRow, type LabeledSelectRowProps, LabeledSwitchRow, SurfaceCard } from "@/design-system";

const CONTROL_RAIL_CLASS = "ml-auto w-full max-w-[30rem]";

export type AccountSyncStatusRow = {
  label: string;
  value: string;
};

type SaveStatus = { message: string; isError: boolean };

type AccountSelectControl = Pick<
  LabeledSelectRowProps,
  "name" | "label" | "value" | "options" | "onChange" | "disabled"
> & { status?: SaveStatus };

type AccountSwitchControl = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  status?: SaveStatus;
};

type AccountSyncSectionViewProps = {
  heading: string;
  note?: string;
  saveNote?: string;
  syncInterval: AccountSelectControl;
  syncOnStartup: AccountSwitchControl;
  syncOnWake: AccountSwitchControl;
  keepReadItems: AccountSelectControl;
  statusRows?: AccountSyncStatusRow[];
  syncNowLabel?: string;
  syncNowSuccessLabel?: string;
  syncNowSucceeded?: boolean;
  syncingLabel?: string;
  onSyncNow?: () => void;
  isSyncing?: boolean;
  actionsDisabled?: boolean;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  devCredentialsRecoveryActionLabel?: string;
  devCredentialsRecoveryLoadingLabel?: string;
  onDevCredentialsRecoveryAction?: () => void;
  isDevCredentialsRecoveryInFlight?: boolean;
  errorMessage?: string | null;
};

type AccountSelectRowProps = {
  control: AccountSelectControl;
};

export function AccountSyncSectionView(props: AccountSyncSectionViewProps) {
  const { heading, note, saveNote, syncInterval, syncOnStartup, syncOnWake, keepReadItems, statusRows, errorMessage } =
    props;

  return (
    <SettingsSection heading={heading} note={note} surface="flat" className="mb-6 sm:mb-7">
      {saveNote && <p className="text-sm text-foreground-soft">{saveNote}</p>}
      <AccountSelectRow control={syncInterval} />
      <LabeledSwitchRow
        label={syncOnStartup.label}
        checked={syncOnStartup.checked}
        onChange={syncOnStartup.onChange}
        disabled={syncOnStartup.disabled}
      />
      <SyncSaveStatus status={syncOnStartup.status} />
      <LabeledSwitchRow
        label={syncOnWake.label}
        checked={syncOnWake.checked}
        onChange={syncOnWake.onChange}
        disabled={syncOnWake.disabled}
      />
      <SyncSaveStatus status={syncOnWake.status} />
      <AccountSelectRow control={keepReadItems} />
      {statusRows && statusRows.length > 0 ? (
        <div className={cn(CONTROL_RAIL_CLASS, "mt-4 px-4 py-3 text-sm", SETTINGS_INFO_SURFACE_CLASS)}>
          {statusRows.map((row) => (
            <div
              key={row.label}
              className={cn(
                "space-y-1 py-3 first:pt-0 last:pb-0 [&:not(:last-child)]:border-b",
                SETTINGS_DIVIDER_CLASS,
              )}
            >
              <div className="system-micro text-foreground-soft">{row.label}</div>
              <div className="break-words text-(length:--font-size-sm) leading-5 text-foreground">{row.value}</div>
            </div>
          ))}
        </div>
      ) : null}
      <AccountSyncActions {...props} />
      {errorMessage ? (
        <SurfaceCard variant="info" tone="danger" padding="compact" role="alert">
          <p className="text-sm leading-[1.5]">{errorMessage}</p>
        </SurfaceCard>
      ) : null}
    </SettingsSection>
  );
}

function AccountSyncActions({
  syncNowLabel,
  syncNowSuccessLabel,
  syncNowSucceeded,
  syncingLabel,
  onSyncNow,
  isSyncing,
  actionsDisabled,
  secondaryActionLabel,
  onSecondaryAction,
  devCredentialsRecoveryActionLabel,
  devCredentialsRecoveryLoadingLabel,
  onDevCredentialsRecoveryAction,
  isDevCredentialsRecoveryInFlight,
}: AccountSyncSectionViewProps) {
  const syncActionDisabled = Boolean(isSyncing || isDevCredentialsRecoveryInFlight || actionsDisabled);
  return onSyncNow || onSecondaryAction || onDevCredentialsRecoveryAction ? (
    <div className={cn(CONTROL_RAIL_CLASS, "flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end lg:pr-2")}>
      {onSecondaryAction && secondaryActionLabel ? (
        <SettingsActionButton size="standalone" onClick={onSecondaryAction} disabled={syncActionDisabled}>
          {secondaryActionLabel}
        </SettingsActionButton>
      ) : null}
      {onDevCredentialsRecoveryAction && devCredentialsRecoveryActionLabel ? (
        <SettingsLoadingActionButton
          size="standalone"
          onClick={onDevCredentialsRecoveryAction}
          loading={isDevCredentialsRecoveryInFlight}
          loadingLabel={devCredentialsRecoveryLoadingLabel}
          disabled={syncActionDisabled}
        >
          {devCredentialsRecoveryActionLabel}
        </SettingsLoadingActionButton>
      ) : null}
      {onSyncNow ? (
        <SettingsLoadingActionButton
          size="standalone"
          onClick={onSyncNow}
          loading={isSyncing}
          loadingLabel={syncingLabel}
          success={syncNowSucceeded}
          successLabel={syncNowSuccessLabel}
          disabled={syncActionDisabled}
        >
          {syncNowLabel}
        </SettingsLoadingActionButton>
      ) : null}
    </div>
  ) : null;
}

function AccountSelectRow({ control }: AccountSelectRowProps) {
  return (
    <>
      <LabeledSelectRow
        label={control.label}
        name={control.name}
        value={control.value}
        options={control.options}
        onChange={control.onChange}
        disabled={control.disabled}
        triggerClassName={SETTINGS_CONTROL_SURFACE_CLASS}
      />
      <SyncSaveStatus status={control.status} />
    </>
  );
}

function SyncSaveStatus({ status }: { status?: SaveStatus }) {
  if (!status) return null;
  if (status.isError)
    return (
      <SurfaceCard variant="info" tone="danger" padding="compact" role="alert">
        <p className="text-sm">{status.message}</p>
      </SurfaceCard>
    );
  return (
    <p role="status" className="text-right text-sm">
      {status.message}
    </p>
  );
}
