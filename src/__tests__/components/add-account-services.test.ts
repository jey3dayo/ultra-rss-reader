import { describe, expect, it } from "vitest";
import {
  findServiceDefinition,
  getDisabledServiceDefinitions,
  getEnabledServiceDefinitions,
} from "@/components/settings/add-account/services";

describe("add-account-services", () => {
  it("keeps enabled add account providers discoverable", () => {
    expect(getEnabledServiceDefinitions().map((service) => service.kind)).toEqual(["Local", "FreshRss"]);
    expect(findServiceDefinition("Local")).toEqual(
      expect.objectContaining({
        kind: "Local",
        nameKey: "account.local_feeds",
        descKey: "account.local_desc",
      }),
    );
    expect(findServiceDefinition("FreshRss")).toEqual(
      expect.objectContaining({
        kind: "FreshRss",
        nameKey: "account.freshrss",
        descKey: "account.freshrss_desc",
      }),
    );
  });

  it("keeps disabled services listed but not discoverable as enabled providers", () => {
    const disabledKinds = getDisabledServiceDefinitions().map((service) => service.kind);

    expect(disabledKinds).toEqual(["Fever", "Inoreader", "Feedly", "NewsBlur", "Feedbin"]);
  });
});
