import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useReducer, useRef } from "react";
import { useTranslation } from "react-i18next";
import { addAccount } from "@/api/tauri-commands";
import { runAccountSetupSync } from "@/components/settings/hooks/account-detail/use-account-detail-sync-controls";
import {
  type AddAccountProviderKind,
  addAccountFormInitialState,
  addAccountFormReducer,
  buildAddAccountPayload,
  formatAddAccountValidationError,
  getAddAccountFormConfig,
} from "@/lib/account/add-account-form";
import { useUiStore } from "@/stores/ui-store";
import { upsertCachedAccount } from "../account-detail/query-cache";
import { AccountConfigFormView } from "./account-config-form-view";
import { findServiceDefinition } from "./services";

export type AccountConfigFormProps = {
  kind: AddAccountProviderKind;
  onBack: () => void;
  debugState?: {
    name?: string;
    serverUrl?: string;
    username?: string;
    password?: string;
    submitting?: boolean;
    errorMessage?: string | null;
    submitMessage?: string | null;
  };
};

type AccountConfigUiState = {
  submitting: boolean;
  errorMessage: string | null;
};

type AccountConfigUiAction =
  | { type: "set-submitting"; value: boolean }
  | { type: "set-error-message"; value: string | null };

const initialAccountConfigUiState: AccountConfigUiState = {
  submitting: false,
  errorMessage: null,
};

const ACCOUNT_KIND_TITLE_KEY: Record<AddAccountProviderKind, "account.local" | "account.freshrss"> = {
  Local: "account.local",
  FreshRss: "account.freshrss",
};

function accountConfigUiReducer(state: AccountConfigUiState, action: AccountConfigUiAction): AccountConfigUiState {
  switch (action.type) {
    case "set-submitting":
      return { ...state, submitting: action.value };
    case "set-error-message":
      return { ...state, errorMessage: action.value };
    default:
      return state;
  }
}

export function AccountConfigForm({ kind, onBack, debugState }: AccountConfigFormProps) {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const setSettingsAddAccount = useUiStore((s) => s.setSettingsAddAccount);
  const setSettingsAccountId = useUiStore((s) => s.setSettingsAccountId);
  const qc = useQueryClient();
  const [form, dispatch] = useReducer(addAccountFormReducer, {
    ...addAccountFormInitialState,
    kind,
    name: debugState?.name ?? addAccountFormInitialState.name,
    serverUrl: debugState?.serverUrl ?? addAccountFormInitialState.serverUrl,
    username: debugState?.username ?? addAccountFormInitialState.username,
    password: debugState?.password ?? addAccountFormInitialState.password,
  });
  const [uiState, dispatchUi] = useReducer(accountConfigUiReducer, {
    ...initialAccountConfigUiState,
    submitting: debugState?.submitting ?? initialAccountConfigUiState.submitting,
    errorMessage: debugState?.errorMessage ?? initialAccountConfigUiState.errorMessage,
  });
  const { submitting, errorMessage } = uiState;
  const submittingRef = useRef(submitting);
  const formConfig = useMemo(() => getAddAccountFormConfig(form.kind), [form.kind]);

  const serviceDef = findServiceDefinition(kind);

  const handleSubmit = async () => {
    if (submittingRef.current) {
      return;
    }

    dispatchUi({ type: "set-error-message", value: null });
    const payloadResult = buildAddAccountPayload(form);

    if (Result.isFailure(payloadResult)) {
      const message = formatAddAccountValidationError(form.kind, Result.unwrapError(payloadResult));
      dispatchUi({ type: "set-error-message", value: message });
      useUiStore.getState().showToast(message);
      return;
    }

    if (debugState?.submitMessage) {
      dispatchUi({ type: "set-error-message", value: debugState.submitMessage });
      return;
    }

    const payload = Result.unwrap(payloadResult);
    submittingRef.current = true;
    dispatchUi({ type: "set-submitting", value: true });
    try {
      Result.pipe(
        await addAccount(payload.kind, payload.name, payload.serverUrl, payload.username, payload.password),
        Result.inspectError((e) => {
          let message: string;
          if (e.type === "Retryable") {
            message = t("account.error_network");
          } else if (e.message.toLowerCase().includes("auth")) {
            message = t("account.error_auth");
            if (kind === "FreshRss") {
              message += `\n${t("account.error_auth_hint_freshrss")}`;
            }
          } else {
            message = t("account.failed_to_add", { message: e.message });
          }
          dispatchUi({ type: "set-error-message", value: message });
          useUiStore.getState().showToast(message);
        }),
        Result.inspect((account) => {
          upsertCachedAccount(qc, account);
          qc.invalidateQueries({ queryKey: ["accounts"] });
          qc.invalidateQueries({ queryKey: ["feeds"] });
          const { selectAccount } = useUiStore.getState();
          selectAccount(account.id);
          setSettingsAccountId(account.id);
          void runAccountSetupSync({
            accountId: account.id,
            queryClient: qc,
            t,
          });
        }),
      );
    } finally {
      submittingRef.current = false;
      dispatchUi({ type: "set-submitting", value: false });
    }
  };

  return (
    <AccountConfigFormView
      title={t(ACCOUNT_KIND_TITLE_KEY[kind])}
      backLabel={tc("back")}
      backAriaLabel={t("account.back_to_services")}
      serviceSummary={
        serviceDef
          ? {
              name: t(serviceDef.nameKey),
              description: t(serviceDef.descKey),
              icon: serviceDef.icon,
              iconBg: serviceDef.iconBg,
            }
          : undefined
      }
      accountHeading={t("account.account")}
      accountName={{
        label: t("account.name"),
        name: "account-name",
        value: form.name,
        onChange: (value) => dispatch({ type: "setField", field: "name", value }),
        placeholder: form.kind,
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
                    onChange: (value) => dispatch({ type: "setField", field: "serverUrl", value }),
                    placeholder: t("account.server_url_placeholder"),
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
      cancelLabel={tc("cancel")}
      submitLabel={tc("add")}
      submittingLabel={formConfig.requiresCredentials ? tc("connection_testing") : tc("adding")}
      submitting={submitting}
      onBack={onBack}
      onCancel={() => setSettingsAddAccount(false)}
      onSubmit={() => void handleSubmit()}
    />
  );
}
