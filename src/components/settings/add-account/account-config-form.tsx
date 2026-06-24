import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useReducer, useRef } from "react";
import { useTranslation } from "react-i18next";
import { runAccountSetupSync } from "@/components/settings/hooks/account-detail/use-account-detail-sync-controls";
import {
  type AddAccountProviderKind,
  type AddAccountValidationError,
  addAccountFormInitialState,
  addAccountFormReducer,
  formatAddAccountValidationError,
  getAddAccountFormConfig,
  isAddAccountFormSubmittable,
  matchAddAccountPayload,
} from "@/lib/account/add-account-form";
import { invalidateQueryKeysLogOnly, queryKeys } from "@/lib/query/query-invalidation";
import { useUiStore } from "@/stores/ui-store";
import { upsertCachedAccount } from "../account-detail/query-cache";
import { matchAddAccountCommand } from "./account-config-actions";
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
  validationError: AddAccountValidationError | null;
};

type AccountConfigUiAction =
  | { type: "set-submitting"; value: boolean }
  | { type: "set-error-message"; value: string | null }
  | { type: "set-validation-error"; value: AddAccountValidationError | null };

type AddAccountRequestSnapshot = {
  requestId: number;
  kind: AddAccountProviderKind;
  name: string;
  serverUrl?: string;
  username?: string;
  password?: string;
};

const initialAccountConfigUiState: AccountConfigUiState = {
  submitting: false,
  errorMessage: null,
  validationError: null,
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
    case "set-validation-error":
      return { ...state, validationError: action.value };
    default:
      return state;
  }
}

function getAddAccountValidationErrorField(error: AddAccountValidationError): "serverUrl" | "username" | "password" {
  switch (error) {
    case "missing_server_url":
    case "invalid_server_url":
    case "server_url_credentials":
      return "serverUrl";
    case "missing_username":
      return "username";
    case "missing_password":
      return "password";
  }
}

function getFreshRssLiveValidationError(form: {
  kind: AddAccountProviderKind;
  serverUrl: string;
  username: string;
  password: string;
}): AddAccountValidationError | null {
  if (form.kind !== "FreshRss") {
    return null;
  }

  const serverUrl = form.serverUrl.trim();
  if (serverUrl.length === 0) {
    return null;
  }

  const serverUrlOnlyPayload = matchAddAccountPayload(
    {
      kind: form.kind,
      name: "",
      serverUrl,
      username: "validation-placeholder",
      password: "validation-placeholder",
    },
    {
      success: () => null,
      failure: (error) => error,
    },
  );
  if (serverUrlOnlyPayload === "invalid_server_url" || serverUrlOnlyPayload === "server_url_credentials") {
    return serverUrlOnlyPayload;
  }

  if (!form.username.trim()) {
    return "missing_username";
  }

  if (!form.password.trim()) {
    return "missing_password";
  }

  return null;
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
  const { submitting, errorMessage, validationError } = uiState;
  const submittingRef = useRef(submitting);
  const submittedSuccessfullyRef = useRef(false);
  const mountedRef = useRef(false);
  const submitRequestIdRef = useRef(0);
  const formRef = useRef(form);
  const formConfig = useMemo(() => getAddAccountFormConfig(form.kind), [form.kind]);

  const serviceDef = findServiceDefinition(kind);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  const isCurrentSubmitSnapshot = (snapshot: AddAccountRequestSnapshot) => {
    const current = formRef.current;
    return (
      mountedRef.current &&
      snapshot.requestId === submitRequestIdRef.current &&
      current.kind === snapshot.kind &&
      current.name === snapshot.name &&
      current.serverUrl === (snapshot.serverUrl ?? "") &&
      current.username === (snapshot.username ?? "") &&
      current.password === (snapshot.password ?? "")
    );
  };

  const handleSubmit = async () => {
    if (submittingRef.current || submittedSuccessfullyRef.current) {
      return;
    }

    dispatchUi({ type: "set-error-message", value: null });
    dispatchUi({ type: "set-validation-error", value: null });
    if (debugState?.submitMessage) {
      dispatchUi({
        type: "set-error-message",
        value: debugState.submitMessage,
      });
      return;
    }

    const payload = matchAddAccountPayload(form, {
      success: (value) => value,
      failure: (error) => {
        const message = t(formatAddAccountValidationError(form.kind, error));
        dispatchUi({ type: "set-error-message", value: message });
        dispatchUi({ type: "set-validation-error", value: error });
        useUiStore.getState().showToast(message);
        return null;
      },
    });
    if (payload === null) {
      return;
    }
    const requestSnapshot: AddAccountRequestSnapshot = {
      requestId: submitRequestIdRef.current + 1,
      kind: payload.kind,
      name: form.name,
      serverUrl: form.serverUrl,
      username: form.username,
      password: form.password,
    };
    submitRequestIdRef.current = requestSnapshot.requestId;
    submittingRef.current = true;
    dispatchUi({ type: "set-submitting", value: true });
    useUiStore.getState().startAccountSetupVerification();
    try {
      await matchAddAccountCommand(payload, {
        onFailure: (e) => {
          if (!isCurrentSubmitSnapshot(requestSnapshot)) {
            useUiStore.getState().clearAccountSetup();
            return;
          }

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
          useUiStore.getState().clearAccountSetup();
        },
        onSuccess: (account) => {
          if (!isCurrentSubmitSnapshot(requestSnapshot)) {
            useUiStore.getState().clearAccountSetup();
            return;
          }

          submittedSuccessfullyRef.current = true;
          upsertCachedAccount(qc, account);
          invalidateQueryKeysLogOnly(qc, [queryKeys.accounts.root, queryKeys.feeds.root]);
          const { selectAccount } = useUiStore.getState();
          selectAccount(account.id);
          setSettingsAccountId(account.id);
          void runAccountSetupSync({
            accountId: account.id,
            queryClient: qc,
            t,
            owner: "add-account",
            shouldApplyFinalUiAction: () => {
              if (!isCurrentSubmitSnapshot(requestSnapshot)) {
                return false;
              }

              const state = useUiStore.getState();
              return (
                state.accountSetupSession?.owner === "add-account" &&
                state.accountSetupSession.state !== "verifying" &&
                state.accountSetupSession.accountId === account.id &&
                state.settingsAccountId === account.id &&
                !state.settingsAddAccount
              );
            },
          });
        },
      });
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) {
        dispatchUi({ type: "set-submitting", value: false });
      }
    }
  };

  const handleFieldChange = (field: "name" | "serverUrl" | "username" | "password", value: string) => {
    dispatch({ type: "setField", field, value });
    if (validationError != null && getAddAccountValidationErrorField(validationError) === field) {
      dispatchUi({ type: "set-validation-error", value: null });
    }
  };

  const validationErrorField = validationError != null ? getAddAccountValidationErrorField(validationError) : null;
  const liveValidationError = getFreshRssLiveValidationError(form);
  const resolvedValidationError = validationError ?? liveValidationError;
  const resolvedValidationErrorField =
    resolvedValidationError != null ? getAddAccountValidationErrorField(resolvedValidationError) : validationErrorField;
  const validationErrorMessage =
    resolvedValidationError != null
      ? t(formatAddAccountValidationError(form.kind, resolvedValidationError))
      : undefined;
  const validationErrorFor = (field: "serverUrl" | "username" | "password") =>
    resolvedValidationErrorField === field ? validationErrorMessage : undefined;
  const submitDisabled = !isAddAccountFormSubmittable(form);

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
        onChange: (value) => handleFieldChange("name", value),
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
                    onChange: (value) => handleFieldChange("serverUrl", value),
                    placeholder: t("account.server_url_placeholder"),
                    disabled: submitting,
                    errorText: validationErrorFor("serverUrl"),
                  }
                : undefined,
              credential: {
                label: formConfig.credentialLabel ?? "",
                name: formConfig.credentialName ?? "",
                value: form.username,
                onChange: (value) => handleFieldChange("username", value),
                disabled: submitting,
                errorText: validationErrorFor("username"),
              },
              password: {
                label: t("account.password"),
                name: "password",
                type: "password",
                value: form.password,
                onChange: (value) => handleFieldChange("password", value),
                disabled: submitting,
                errorText: validationErrorFor("password"),
              },
            }
          : undefined
      }
      errorMessage={errorMessage}
      cancelLabel={tc("cancel")}
      submitLabel={tc("add")}
      submittingLabel={formConfig.requiresCredentials ? tc("connection_testing") : tc("adding")}
      submitting={submitting}
      submitDisabled={submitDisabled}
      onBack={onBack}
      onCancel={() => setSettingsAddAccount(false)}
      onSubmit={() => void handleSubmit()}
    />
  );
}
