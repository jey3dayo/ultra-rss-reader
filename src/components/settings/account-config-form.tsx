import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { useId, useMemo, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { addAccount } from "@/api/tauri-commands";
import { SERVICE_CATEGORIES } from "@/components/settings/service-picker";
import { SectionHeading } from "@/components/shared/section-heading";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AddAccountProviderKind } from "@/lib/add-account-form";
import {
  addAccountFormInitialState,
  addAccountFormReducer,
  buildAddAccountPayload,
  formatAddAccountValidationError,
  getAddAccountFormConfig,
} from "@/lib/add-account-form";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";

function findServiceDefinition(kind: AddAccountProviderKind) {
  for (const category of SERVICE_CATEGORIES) {
    for (const service of category.services) {
      if (service.kind === kind) return service;
    }
  }
  return null;
}

export function AccountConfigForm({ kind, onBack }: { kind: AddAccountProviderKind; onBack: () => void }) {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const setSettingsAddAccount = useUiStore((s) => s.setSettingsAddAccount);
  const setSettingsAccountId = useUiStore((s) => s.setSettingsAccountId);
  const qc = useQueryClient();
  const [form, dispatch] = useReducer(addAccountFormReducer, { ...addAccountFormInitialState, kind });
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const formConfig = useMemo(() => getAddAccountFormConfig(form.kind), [form.kind]);
  const accountNameId = useId();
  const serverUrlId = useId();
  const credentialId = useId();
  const passwordId = useId();

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
          <LabeledControlRow label={t("account.name")} htmlFor={accountNameId}>
            <Input
              id={accountNameId}
              name="account-name"
              value={form.name}
              onChange={(e) => dispatch({ type: "setField", field: "name", value: e.target.value })}
              placeholder={form.kind}
              className="h-auto w-auto border-border bg-background px-2 py-1 text-sm"
              disabled={submitting}
            />
          </LabeledControlRow>
        </section>

        {formConfig.requiresCredentials && (
          <section className="mb-6">
            <SectionHeading>{formConfig.sectionHeading}</SectionHeading>
            {formConfig.showServerUrl && (
              <LabeledControlRow label={t("account.server_url")} htmlFor={serverUrlId}>
                <Input
                  id={serverUrlId}
                  name="server-url"
                  value={form.serverUrl}
                  onChange={(e) => dispatch({ type: "setField", field: "serverUrl", value: e.target.value })}
                  placeholder={t("account.server_url_placeholder")}
                  className="h-auto w-auto border-border bg-background px-2 py-1 text-sm"
                  disabled={submitting}
                />
              </LabeledControlRow>
            )}
            <LabeledControlRow label={formConfig.credentialLabel ?? ""} htmlFor={credentialId}>
              <Input
                id={credentialId}
                name={formConfig.credentialName ?? undefined}
                value={form.username}
                onChange={(e) => dispatch({ type: "setField", field: "username", value: e.target.value })}
                className="h-auto w-auto border-border bg-background px-2 py-1 text-sm"
                disabled={submitting}
              />
            </LabeledControlRow>
            <LabeledControlRow label={t("account.password")} htmlFor={passwordId}>
              <Input
                id={passwordId}
                name="password"
                type="password"
                value={form.password}
                onChange={(e) => dispatch({ type: "setField", field: "password", value: e.target.value })}
                className="h-auto w-auto border-border bg-background px-2 py-1 text-sm"
                disabled={submitting}
              />
            </LabeledControlRow>
          </section>
        )}

        {errorMessage && <p className="mb-4 text-sm text-destructive">{errorMessage}</p>}

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? (formConfig.requiresCredentials ? tc("connection_testing") : tc("adding")) : tc("add")}
          </Button>
          <Button variant="outline" type="button" onClick={() => setSettingsAddAccount(false)} disabled={submitting}>
            {tc("cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
