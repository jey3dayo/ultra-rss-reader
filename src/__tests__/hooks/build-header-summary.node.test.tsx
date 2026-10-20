import { sampleAccounts } from "@tests/helpers/fixtures";
import i18n from "@tests/helpers/i18n-setup";
import type { TFunction } from "i18next";
import { type ComponentProps, isValidElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import type { AccountSyncStatusDto } from "@/api/tauri-commands";
import type { AccountConnectionSummary } from "@/components/settings/account-connection-summary";
import type { AccountDetailAccount } from "@/components/settings/account-detail/types";
import { buildHeaderSummary } from "@/components/settings/hooks/account-detail/build-header-summary";

type HeaderSummaryBadgeProps = Pick<ComponentProps<typeof AccountConnectionSummary>, "statusLabel" | "statusTone">;

function readHeaderSummaryProps(node: ReactNode): HeaderSummaryBadgeProps {
  if (!isValidElement<HeaderSummaryBadgeProps>(node)) {
    throw new Error("expected the header summary element");
  }
  return { statusLabel: node.props.statusLabel, statusTone: node.props.statusTone };
}

function createSyncStatus(overrides: Partial<AccountSyncStatusDto>): AccountSyncStatusDto {
  return {
    last_success_at: null,
    next_retry_at: null,
    error_count: 0,
    last_error: null,
    waiting_for_credential_access: false,
    ...overrides,
  };
}

describe("buildHeaderSummary", () => {
  const account = { ...sampleAccounts[1], kind: "FreshRss" } satisfies AccountDetailAccount;
  const language = "ja";
  const t: TFunction<"settings"> = i18n.getFixedT(language, "settings");

  it("shows the reauthorization required badge while waiting for credential access", () => {
    const node = buildHeaderSummary({
      account,
      verificationStatus: "verified",
      syncStatus: createSyncStatus({ waiting_for_credential_access: true }),
      language,
      t,
    });

    expect(readHeaderSummaryProps(node)).toEqual({
      statusLabel: "要再許可",
      statusTone: "warning",
    });
  });

  it("keeps the verified badge when not waiting for credential access", () => {
    const node = buildHeaderSummary({
      account,
      verificationStatus: "verified",
      syncStatus: createSyncStatus({}),
      language,
      t,
    });

    expect(readHeaderSummaryProps(node)).toEqual({
      statusLabel: "確認済み",
      statusTone: "success",
    });
  });
});
