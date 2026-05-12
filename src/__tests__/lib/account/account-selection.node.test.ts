import { describe, expect, it } from "vitest";
import { getPreferredAccountId, resolveRestoredAccountSelection } from "@/lib/account/account-selection";

const accounts = [{ id: "acc-disabled", disabled: true }, { id: "acc-1" }, { id: "acc-2" }];

describe("account selection", () => {
  it("falls back to the first selectable account when the saved account is disabled or deleted", () => {
    expect(getPreferredAccountId(accounts, "acc-disabled")).toBe("acc-1");
    expect(getPreferredAccountId(accounts, "acc-deleted")).toBe("acc-1");
  });

  it("treats enabled false accounts as unselectable without affecting existing account shapes", () => {
    expect(
      getPreferredAccountId(
        [
          { id: "acc-disabled", enabled: false },
          { id: "acc-active", enabled: true },
        ],
        "acc-disabled",
      ),
    ).toBe("acc-active");

    expect(getPreferredAccountId([{ id: "acc-existing" }], "acc-existing")).toBe("acc-existing");
  });

  it("repairs restored selection when the selected account is disabled", () => {
    expect(
      resolveRestoredAccountSelection({
        accounts,
        selectedAccountId: "acc-disabled",
        savedAccountId: "acc-2",
      }),
    ).toEqual({
      accountId: "acc-2",
      preferenceAccountId: "acc-2",
    });
  });

  it("clears restored selection when no selectable accounts remain", () => {
    expect(
      resolveRestoredAccountSelection({
        accounts: [{ id: "acc-disabled", disabled: true }],
        selectedAccountId: "acc-disabled",
        savedAccountId: "acc-disabled",
      }),
    ).toEqual({
      accountId: null,
      preferenceAccountId: "",
    });
  });
});
