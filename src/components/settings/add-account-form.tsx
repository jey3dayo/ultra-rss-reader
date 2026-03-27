import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useReducer } from "react";
import { addAccount } from "@/api/tauri-commands";
import { SectionHeading } from "@/components/settings/settings-components";
import { Button } from "@/components/ui/button";
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
  const setSettingsAddAccount = useUiStore((s) => s.setSettingsAddAccount);
  const setSettingsAccountId = useUiStore((s) => s.setSettingsAccountId);
  const qc = useQueryClient();
  const [form, dispatch] = useReducer(addAccountFormReducer, addAccountFormInitialState);
  const formConfig = useMemo(() => getAddAccountFormConfig(form.kind), [form.kind]);

  const handleSubmit = async () => {
    const payloadResult = buildAddAccountPayload(form);

    if (Result.isFailure(payloadResult)) {
      useUiStore.getState().showToast(formatAddAccountValidationError(form.kind, Result.unwrapError(payloadResult)));
      return;
    }

    const payload = Result.unwrap(payloadResult);

    Result.pipe(
      await addAccount(payload.kind, payload.name, payload.serverUrl, payload.username, payload.password),
      Result.inspectError((e) => useUiStore.getState().showToast(`Failed to add account: ${e.message}`)),
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
      <h2 className="mb-6 text-center text-lg font-semibold">Add Account</h2>

      <section className="mb-6">
        <SectionHeading>Account</SectionHeading>
        <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
          <span className="text-sm text-foreground">Type</span>
          <select
            name="account-type"
            value={form.kind}
            onChange={(e) => dispatch({ type: "setKind", value: e.target.value as AddAccountProviderKind })}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
          >
            <option value="Local">Local Feeds</option>
            <option value="FreshRss">FreshRSS</option>
            <option value="Inoreader">Inoreader</option>
          </select>
        </div>
        <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
          <span className="text-sm text-foreground">Name</span>
          <input
            name="account-name"
            value={form.name}
            onChange={(e) => dispatch({ type: "setField", field: "name", value: e.target.value })}
            placeholder={form.kind}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
          />
        </div>
      </section>

      {formConfig.requiresCredentials && (
        <section className="mb-6">
          <SectionHeading>{formConfig.sectionHeading}</SectionHeading>
          {formConfig.showServerUrl && (
            <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
              <span className="text-sm text-foreground">Server URL</span>
              <input
                name="server-url"
                value={form.serverUrl}
                onChange={(e) => dispatch({ type: "setField", field: "serverUrl", value: e.target.value })}
                placeholder="https://your-freshrss.com"
                className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
              />
            </div>
          )}
          <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
            <span className="text-sm text-foreground">{formConfig.credentialLabel}</span>
            <input
              name={formConfig.credentialName ?? undefined}
              value={form.username}
              onChange={(e) => dispatch({ type: "setField", field: "username", value: e.target.value })}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
            />
          </div>
          <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
            <span className="text-sm text-foreground">Password</span>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={(e) => dispatch({ type: "setField", field: "password", value: e.target.value })}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
            />
          </div>
        </section>
      )}

      <div className="flex gap-3">
        <Button onClick={handleSubmit}>Add</Button>
        <Button variant="outline" onClick={() => setSettingsAddAccount(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
