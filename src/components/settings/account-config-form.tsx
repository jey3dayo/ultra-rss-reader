import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { useMemo, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { addAccount } from "@/api/tauri-commands";
import { FormActionButtons } from "@/components/shared/form-action-buttons";
import { LabeledInputRow } from "@/components/shared/labeled-input-row";
import { SectionHeading } from "@/components/shared/section-heading";
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
      {/* Header with back button */}
      <div className="relative mb-6 flex items-center">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          aria-label={t("account.back_to_services")}
          className="flex items-center gap-0.5 text-sm text-primary hover:text-primary/80 disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
          {tc("back")}
        </button>
        <h2 className="absolute inset-x-0 text-center text-lg font-semibold">
          {t(`account.${kind.toLowerCase()}` as "account.local")}
        </h2>
      </div>

      {/* Service info banner */}
      {serviceDef && (
        <div className="mb-6 flex items-center gap-3 rounded-lg bg-muted/50 p-3">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", serviceDef.iconBg)}>
            <serviceDef.icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-medium">{t(serviceDef.nameKey as "account.local_feeds")}</div>
            <div className="text-xs text-muted-foreground">{t(serviceDef.descKey as "account.local_desc")}</div>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <section className="mb-6">
          <SectionHeading>{t("account.account")}</SectionHeading>
          <LabeledInputRow
            label={t("account.name")}
            name="account-name"
            value={form.name}
            onChange={(value) => dispatch({ type: "setField", field: "name", value })}
            placeholder={form.kind}
            inputClassName="h-auto w-auto border-border bg-background px-2 py-1 text-sm"
            disabled={submitting}
          />
        </section>

        {formConfig.requiresCredentials && (
          <section className="mb-6">
            <SectionHeading>{formConfig.sectionHeading}</SectionHeading>
            {formConfig.showServerUrl && (
              <LabeledInputRow
                label={t("account.server_url")}
                name="server-url"
                value={form.serverUrl}
                onChange={(value) => dispatch({ type: "setField", field: "serverUrl", value })}
                placeholder={t("account.server_url_placeholder")}
                inputClassName="h-auto w-auto border-border bg-background px-2 py-1 text-sm"
                disabled={submitting}
              />
            )}
            <LabeledInputRow
              label={formConfig.credentialLabel ?? ""}
              name={formConfig.credentialName ?? undefined}
              value={form.username}
              onChange={(value) => dispatch({ type: "setField", field: "username", value })}
              inputClassName="h-auto w-auto border-border bg-background px-2 py-1 text-sm"
              disabled={submitting}
            />
            <LabeledInputRow
              label={t("account.password")}
              name="password"
              type="password"
              value={form.password}
              onChange={(value) => dispatch({ type: "setField", field: "password", value })}
              inputClassName="h-auto w-auto border-border bg-background px-2 py-1 text-sm"
              disabled={submitting}
            />
          </section>
        )}

        {errorMessage && <p className="mb-4 text-sm text-destructive">{errorMessage}</p>}

        <div className="flex gap-3">
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
