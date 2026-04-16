import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { useMemo, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { addAccount } from "@/api/tauri-commands";
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
import { useUiStore } from "@/stores/ui-store";
import { findServiceDefinition } from "./add-account-services";
import type { AccountConfigFormProps } from "./add-account-services.types";

export function AccountConfigForm({ kind, onBack }: AccountConfigFormProps) {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const setSettingsAddAccount = useUiStore((s) => s.setSettingsAddAccount);
  const setSettingsAccountId = useUiStore((s) => s.setSettingsAccountId);
  const qc = useQueryClient();
  const [form, dispatch] = useReducer(addAccountFormReducer, { ...addAccountFormInitialState, kind });
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const formConfig = useMemo(() => getAddAccountFormConfig(form.kind), [form.kind]);

  const serviceDef = findServiceDefinition(kind);
  const labelColumnClassName = "sm:w-28 sm:shrink-0";
  const inputRowClassName = "flex-col items-stretch sm:flex-row sm:items-center sm:justify-start";
  const inputControlClassName = "sm:min-w-0 sm:flex-1";
  const inputClassName = "h-auto w-full border-border bg-background px-3 py-2 text-sm sm:flex-1";

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

    Result.pipe(
      await addAccount(payload.kind, payload.name, payload.serverUrl, payload.username, payload.password),
      Result.inspectError((e) => {
        const appError = e as { type?: string; message: string };
        let message: string;
        if (appError.type === "Retryable") {
          message = t("account.error_network");
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
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", serviceDef.iconBg)}>
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
            rowClassName={inputRowClassName}
            labelClassName={labelColumnClassName}
            controlClassName={inputControlClassName}
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
                rowClassName={inputRowClassName}
                labelClassName={labelColumnClassName}
                controlClassName={inputControlClassName}
                inputClassName={inputClassName}
                disabled={submitting}
              />
            )}
            <LabeledInputRow
              label={formConfig.credentialLabel ?? ""}
              name={formConfig.credentialName ?? undefined}
              value={form.username}
              onChange={(value) => dispatch({ type: "setField", field: "username", value })}
              rowClassName={inputRowClassName}
              labelClassName={labelColumnClassName}
              controlClassName={inputControlClassName}
              inputClassName={inputClassName}
              disabled={submitting}
            />
            <LabeledInputRow
              label={t("account.password")}
              name="password"
              type="password"
              value={form.password}
              onChange={(value) => dispatch({ type: "setField", field: "password", value })}
              rowClassName={inputRowClassName}
              labelClassName={labelColumnClassName}
              controlClassName={inputControlClassName}
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
