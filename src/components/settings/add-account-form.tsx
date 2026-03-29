import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useMemo, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { addAccount } from "@/api/tauri-commands";
import { SectionHeading } from "@/components/settings/settings-components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const formConfig = useMemo(() => getAddAccountFormConfig(form.kind), [form.kind]);
  const accountTypeLabelId = useId();
  const accountTypeOptions = [
    { value: "Local", label: t("account.local_feeds") },
    { value: "FreshRss", label: t("account.freshrss") },
    { value: "Inoreader", label: t("account.inoreader") },
  ];
  const getAccountTypeLabel = (value: string | null) =>
    accountTypeOptions.find((option) => option.value === (value ?? ""))?.label ?? value ?? "";

  const handleSubmit = async () => {
    const payloadResult = buildAddAccountPayload(form);

    if (Result.isFailure(payloadResult)) {
      useUiStore.getState().showToast(formatAddAccountValidationError(form.kind, Result.unwrapError(payloadResult)));
      return;
    }

    const payload = Result.unwrap(payloadResult);

    Result.pipe(
      await addAccount(payload.kind, payload.name, payload.serverUrl, payload.username, payload.password),
      Result.inspectError((e) => useUiStore.getState().showToast(t("account.failed_to_add", { message: e.message }))),
      Result.inspect((account) => {
        qc.invalidateQueries({ queryKey: ["accounts"] });
        qc.invalidateQueries({ queryKey: ["feeds"] });
        const { selectAccount } = useUiStore.getState();
        selectAccount(account.id);
        setSettingsAccountId(account.id);
      }),
    );
  };

  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">{t("account.heading")}</h2>

      <section className="mb-6">
        <SectionHeading>{t("account.account")}</SectionHeading>
        <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
          <span id={accountTypeLabelId} className="text-sm text-foreground">
            {t("account.type")}
          </span>
          <Select
            name="account-type"
            value={form.kind}
            onValueChange={(v) => v !== null && dispatch({ type: "setKind", value: v as AddAccountProviderKind })}
          >
            <SelectTrigger aria-labelledby={accountTypeLabelId}>
              <SelectValue>{(value: string | null) => getAccountTypeLabel(value)}</SelectValue>
            </SelectTrigger>
            <SelectPopup>
              {accountTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>
        <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
          <span className="text-sm text-foreground">{t("account.name")}</span>
          <Input
            name="account-name"
            value={form.name}
            onChange={(e) => dispatch({ type: "setField", field: "name", value: e.target.value })}
            placeholder={form.kind}
            className="h-auto w-auto border-border bg-background px-2 py-1 text-sm"
          />
        </div>
      </section>

      {formConfig.requiresCredentials && (
        <section className="mb-6">
          <SectionHeading>{formConfig.sectionHeading}</SectionHeading>
          {formConfig.showServerUrl && (
            <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
              <span className="text-sm text-foreground">{t("account.server_url")}</span>
              <Input
                name="server-url"
                value={form.serverUrl}
                onChange={(e) => dispatch({ type: "setField", field: "serverUrl", value: e.target.value })}
                placeholder={t("account.server_url_placeholder")}
                className="h-auto w-auto border-border bg-background px-2 py-1 text-sm"
              />
            </div>
          )}
          <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
            <span className="text-sm text-foreground">{formConfig.credentialLabel}</span>
            <Input
              name={formConfig.credentialName ?? undefined}
              value={form.username}
              onChange={(e) => dispatch({ type: "setField", field: "username", value: e.target.value })}
              className="h-auto w-auto border-border bg-background px-2 py-1 text-sm"
            />
          </div>
          <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
            <span className="text-sm text-foreground">{t("account.password")}</span>
            <Input
              name="password"
              type="password"
              value={form.password}
              onChange={(e) => dispatch({ type: "setField", field: "password", value: e.target.value })}
              className="h-auto w-auto border-border bg-background px-2 py-1 text-sm"
            />
          </div>
        </section>
      )}

      <div className="flex gap-3">
        <Button onClick={handleSubmit}>{tc("add")}</Button>
        <Button variant="outline" onClick={() => setSettingsAddAccount(false)}>
          {tc("cancel")}
        </Button>
      </div>
    </div>
  );
}
