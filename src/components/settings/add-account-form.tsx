import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { addAccount } from "@/api/tauri-commands";
import { AddAccountFormView } from "@/components/settings/add-account-form-view";
import {
  type AddAccountProviderKind,
  addAccountFormInitialState,
  addAccountFormReducer,
  buildAddAccountPayload,
  formatAddAccountValidationError,
  getAddAccountFormConfig,
} from "@/lib/add-account-form";
import { useUiStore } from "@/stores/ui-store";

export function AddAccountForm() {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const setSettingsAddAccount = useUiStore((s) => s.setSettingsAddAccount);
  const setSettingsAccountId = useUiStore((s) => s.setSettingsAccountId);
  const qc = useQueryClient();
  const [form, dispatch] = useReducer(addAccountFormReducer, addAccountFormInitialState);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const formConfig = useMemo(() => getAddAccountFormConfig(form.kind), [form.kind]);
  const accountTypeOptions = [
    { value: "Local", label: t("account.local_feeds") },
    { value: "FreshRss", label: t("account.freshrss") },
    { value: "Inoreader", label: t("account.inoreader") },
  ];

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
        const message = t("account.failed_to_add", { message: e.message });
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
    <AddAccountFormView
      title={t("account.heading")}
      accountHeading={t("account.account")}
      accountType={{
        label: t("account.type"),
        name: "account-type",
        value: form.kind,
        options: accountTypeOptions,
        onChange: (value) => dispatch({ type: "setKind", value: value as AddAccountProviderKind }),
        disabled: submitting,
      }}
      accountName={{
        label: t("account.name"),
        name: "account-name",
        value: form.name,
        placeholder: form.kind,
        onChange: (value) => dispatch({ type: "setField", field: "name", value }),
        disabled: submitting,
      }}
      credentialsSection={
        formConfig.requiresCredentials
          ? {
              heading: formConfig.sectionHeading,
              serverUrl: formConfig.showServerUrl
                ? {
                    label: t("account.server_url"),
                    name: "server-url",
                    value: form.serverUrl,
                    placeholder: t("account.server_url_placeholder"),
                    onChange: (value) => dispatch({ type: "setField", field: "serverUrl", value }),
                    disabled: submitting,
                  }
                : undefined,
              credential: {
                label: formConfig.credentialLabel ?? "",
                name: formConfig.credentialName ?? "",
                value: form.username,
                onChange: (value) => dispatch({ type: "setField", field: "username", value }),
                disabled: submitting,
              },
              password: {
                label: t("account.password"),
                name: "password",
                type: "password",
                value: form.password,
                onChange: (value) => dispatch({ type: "setField", field: "password", value }),
                disabled: submitting,
              },
            }
          : undefined
      }
      errorMessage={errorMessage}
      submitLabel={tc("add")}
      submittingLabel={tc("adding")}
      cancelLabel={tc("cancel")}
      submitting={submitting}
      onSubmit={() => void handleSubmit()}
      onCancel={() => setSettingsAddAccount(false)}
    />
  );
}
