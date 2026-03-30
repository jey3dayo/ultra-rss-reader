import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountDetail } from "@/components/settings/account-detail";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

const accountDetailViewSpy = vi.fn();

vi.mock("@/components/settings/account-detail-view", () => ({
  AccountDetailView: (props: {
    syncSection: {
      keepReadItems: {
        options: Array<{ value: string; label: string }>;
        onChange: (value: string) => void;
      };
    };
  }) => {
    accountDetailViewSpy(props);

    return (
      <div>
        <button type="button" onClick={() => props.syncSection.keepReadItems.onChange("60")}>
          Select 60 days
        </button>
        <ul>
          {props.syncSection.keepReadItems.options.map((option) => (
            <li key={option.value}>{option.label}</li>
          ))}
        </ul>
      </div>
    );
  },
}));

describe("AccountDetail", () => {
  beforeEach(() => {
    accountDetailViewSpy.mockClear();
    useUiStore.setState(useUiStore.getInitialState());
    useUiStore.setState({ settingsAccountId: "acc-1" });
  });

  it("offers a 60 day retention option and persists it through update_account_sync", async () => {
    const user = userEvent.setup();
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];

    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_accounts":
          return [
            {
              id: "acc-1",
              kind: "Local",
              name: "Local",
              username: null,
              server_url: null,
              sync_interval_secs: 3600,
              sync_on_wake: false,
              keep_read_items_days: 30,
            },
          ];
        case "update_account_sync":
          return {
            id: "acc-1",
            kind: "Local",
            name: "Local",
            username: null,
            server_url: null,
            sync_interval_secs: Number(args.syncIntervalSecs),
            sync_on_wake: Boolean(args.syncOnWake),
            keep_read_items_days: Number(args.keepReadItemsDays),
          };
        default:
          return null;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    expect(await screen.findByText("60 days")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Select 60 days" }));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "update_account_sync",
        args: {
          accountId: "acc-1",
          syncIntervalSecs: 3600,
          syncOnWake: false,
          keepReadItemsDays: 60,
        },
      });
    });

    expect(accountDetailViewSpy).toHaveBeenCalled();
  });
});
