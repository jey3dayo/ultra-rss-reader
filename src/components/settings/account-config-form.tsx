import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { useMemo, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { addAccount, setPreference } from "@/api/tauri-commands";
import { SettingsSection } from "@/components/settings/settings-section";
import { FormActionButtons } from "@/components/shared/form-action-buttons";
import { LabeledInputRow } from "@/components/shared/labeled-input-row";
import { SurfaceCard } from "@/components/shared/surface-card";
import {
  addAccountFormInitialState,
  addAccountFormReducer,
  buildAddAccountPayload,
  formatAddAccountValidationError,
  getAddAccountFormConfig,
} from "@/lib/add-account-form";
import { cn } from "@/lib/utils";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { findServiceDefinition } from "./add-account-services";
import type { AccountConfigFormProps } from "./add-account-services.types";

export function AccountConfigForm({ kind, onBack }: AccountConfigFormProps) {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const setSettingsAddAccount = useUiStore((s) => s.setSettingsAddAccount);
  const setSettingsAccountId = useUiStore((s) => s.setSettingsAccountId);
  const prefs = usePreferencesStore((s) => s.prefs);
  const qc = useQueryClient();
  const [form, dispatch] = useReducer(addAccountFormReducer, {
    ...addAccountFormInitialState,
    kind,
    appId: kind === "Inoreader" ? resolvePreferenceValue(prefs, "inoreader_app_id") : "",
    appKey: kind === "Inoreader" ? resolvePreferenceValue(prefs, "inoreader_app_key") : "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const formConfig = useMemo(() => getAddAccountFormConfig(form.kind), [form.kind]);

  const serviceDef = findServiceDefinition(kind);
  const labelColumnClassName = "sm:w-40 sm:shrink-0";
  const inputClassName = "h-10";

  const persistInoreaderPreferences = async (appId: string, appKey: string) => {
    const saveAppId = await setPreference("inoreader_app_id", appId);
    if (Result.isFailure(saveAppId)) {
      return Result.fail(Result.unwrapError(saveAppId));
    }

    const saveAppKey = await setPreference("inoreader_app_key", appKey);
    if (Result.isFailure(saveAppKey)) {
      return Result.fail(Result.unwrapError(saveAppKey));
    }

    usePreferencesStore.setState((state) => ({
      prefs: {
        ...state.prefs,
        inoreader_app_id: appId,
        inoreader_app_key: appKey,
      },
    }));

    return Result.succeed(undefined);
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    const payloadResult = buildAddAccountPayload(form);

    if (Result.isFailure(payloadResult)) {
      const message = formatAddAccountValidationError(form.kind, Result.unwrapError(payloadResult));
      setErrorMessage(message);
      useUiStore.getState().showToast(message);
      return;
    }

    const payload = Result.unwrap(payloadResult);
    setSubmitting(true);

    if (payload.kind === "Inoreader") {
      const savePrefs = await persistInoreaderPreferences(payload.appId ?? "", payload.appKey ?? "");
      if (Result.isFailure(savePrefs)) {
        const message = t("account.failed_to_save_app_credentials", {
          message: Result.unwrapError(savePrefs).message,
        });
        setErrorMessage(message);
        useUiStore.getState().showToast(message);
        setSubmitting(false);
        return;
      }
    }

    Result.pipe(
      await addAccount(payload.kind, payload.name, payload.serverUrl, payload.username, payload.password),
      Result.inspectError((e) => {
        const appError = e as { type?: string; message: string };
        let message: string;
        if (appError.type === "Retryable") {
          message = t("account.error_network");
        } else if (payload.kind === "Inoreader" && appError.message.toLowerCase().includes("app id")) {
          message = t("account.error_missing_inoreader_app_credentials");
        } else if (appError.message.toLowerCase().includes("auth")) {
          message = t("account.error_auth");
          if (kind === "FreshRss") {
            message += `\n${t("account.error_auth_hint_freshrss")}`;
          }
        } else {
          message = t("account.failed_to_add", { message: e.message });
        }
        setErrorMessage(message);
        useUiStore.getState().showToast(message);
      }),
      Result.inspect((account) => {
        qc.invalidateQueries({ queryKey: ["accounts"] });
        qc.invalidateQueries({ queryKey: ["feeds"] });
        const { selectAccount } = useUiStore.getState();
        selectAccount(account.id);
        setSettingsAccountId(account.id);
      }),
    );

    setSubmitting(false);
  };

  return (
    <div className="p-6">
      <div className="mb-5 grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border/60 pb-4">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          aria-label={t("account.back_to_services")}
          className="inline-flex items-center gap-0.5 justify-self-start text-sm text-foreground-soft transition-colors hover:text-foreground disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
          {tc("back")}
        </button>
        <h2 className="text-center font-sans text-[19px] font-medium tracking-[-0.02em] text-foreground">
          {t(`account.${kind.toLowerCase()}` as "account.local")}
        </h2>
        <div aria-hidden="true" className="h-8 w-8 justify-self-end" />
      </div>

      {serviceDef && (
        <SurfaceCard variant="info" tone="subtle" padding="compact" className="mb-4">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md", serviceDef.iconBg)}>
              <serviceDef.icon className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">
                {t(serviceDef.nameKey as "account.local_feeds")}
              </div>
              <div className="font-serif text-xs leading-[1.45] text-foreground-soft">
                {t(serviceDef.descKey as "account.local_desc")}
              </div>
            </div>
          </div>
        </SurfaceCard>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
        className="space-y-4"
      >
        <SettingsSection heading={t("account.account")}>
          <LabeledInputRow
            label={t("account.name")}
            name="account-name"
            value={form.name}
            onChange={(value) => dispatch({ type: "setField", field: "name", value })}
            placeholder={form.kind}
            labelClassName={labelColumnClassName}
            inputClassName={inputClassName}
            disabled={submitting}
          />
        </SettingsSection>

        {formConfig.requiresCredentials && (
          <SettingsSection heading={formConfig.sectionHeading}>
            {formConfig.showServerUrl && (
              <LabeledInputRow
                label={t("account.server_url")}
                name="server-url"
                value={form.serverUrl}
                onChange={(value) => dispatch({ type: "setField", field: "serverUrl", value })}
                placeholder={t("account.server_url_placeholder")}
                labelClassName={labelColumnClassName}
                inputClassName={inputClassName}
                disabled={submitting}
              />
            )}
            {formConfig.showAppCredentials && (
              <>
                <LabeledInputRow
                  label={t("account.app_id")}
                  name="app-id"
                  value={form.appId}
                  onChange={(value) => dispatch({ type: "setField", field: "appId", value })}
                  labelClassName={labelColumnClassName}
                  inputClassName={inputClassName}
                  disabled={submitting}
                />
                <LabeledInputRow
                  label={t("account.app_key")}
                  name="app-key"
                  type="password"
                  value={form.appKey}
                  onChange={(value) => dispatch({ type: "setField", field: "appKey", value })}
                  labelClassName={labelColumnClassName}
                  inputClassName={inputClassName}
                  disabled={submitting}
                />
              </>
            )}
            <LabeledInputRow
              label={form.kind === "Inoreader" ? t("account.email") : (formConfig.credentialLabel ?? "")}
              name={formConfig.credentialName ?? undefined}
              value={form.username}
              onChange={(value) => dispatch({ type: "setField", field: "username", value })}
              labelClassName={labelColumnClassName}
              inputClassName={inputClassName}
              disabled={submitting}
            />
            <LabeledInputRow
              label={t("account.password")}
              name="password"
              type="password"
              value={form.password}
              onChange={(value) => dispatch({ type: "setField", field: "password", value })}
              labelClassName={labelColumnClassName}
              inputClassName={inputClassName}
              disabled={submitting}
            />
          </SettingsSection>
        )}

        {errorMessage ? (
          <SurfaceCard variant="info" tone="danger" padding="compact">
            <p className="font-serif text-sm leading-[1.5]">{errorMessage}</p>
          </SurfaceCard>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <FormActionButtons
            cancelLabel={tc("cancel")}
            submitLabel={tc("add")}
            submittingLabel={formConfig.requiresCredentials ? tc("connection_testing") : tc("adding")}
            loading={submitting}
            submitDisabled={submitting}
            cancelDisabled={submitting}
            onCancel={() => setSettingsAddAccount(false)}
            submitType="submit"
          />
        </div>
      </form>
    </div>
  );
}
