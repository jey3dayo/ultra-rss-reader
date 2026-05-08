import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { useMemo, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { addAccount } from "@/api/tauri-commands";
import { runAccountSetupSync } from "@/components/settings/hooks/account-detail/use-account-detail-sync-controls";
import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { FormActionButtons } from "@/components/shared/form-action-buttons";
import { LabeledInputRow } from "@/components/shared/labeled-input-row";
import { SurfaceCard } from "@/components/shared/surface-card";
import {
  type AddAccountProviderKind,
  addAccountFormInitialState,
  addAccountFormReducer,
  buildAddAccountPayload,
  formatAddAccountValidationError,
  getAddAccountFormConfig,
} from "@/lib/account/add-account-form";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { upsertCachedAccount } from "../account-detail/query-cache";
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
  const formConfig = useMemo(() => getAddAccountFormConfig(form.kind), [form.kind]);

  const serviceDef = findServiceDefinition(kind);
  const labelColumnClassName = "sm:w-40 sm:shrink-0";
  const inputClassName = "h-10";

  const handleSubmit = async () => {
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
    dispatchUi({ type: "set-submitting", value: true });

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

    dispatchUi({ type: "set-submitting", value: false });
  };

  return (
    <div className="p-6">
      <div className="mb-5 grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border/60 pb-4">
        <SettingsActionButton
          type="button"
          tone="subtle"
          size="compact"
          onClick={onBack}
          disabled={submitting}
          aria-label={t("account.back_to_services")}
          className="h-8 gap-0.5 justify-self-start bg-transparent px-1 text-sm shadow-none"
        >
          <ChevronLeft className="h-4 w-4" />
          {tc("back")}
        </SettingsActionButton>
        <h2 className="text-center font-sans text-[19px] font-medium tracking-[-0.02em] text-foreground">
          {t(ACCOUNT_KIND_TITLE_KEY[kind])}
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
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <span>{t(serviceDef.nameKey)}</span>
              </div>
              <div className="font-serif text-xs leading-[1.45] text-foreground-soft">{t(serviceDef.descKey)}</div>
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
            <LabeledInputRow
              label={formConfig.credentialLabel ?? ""}
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
