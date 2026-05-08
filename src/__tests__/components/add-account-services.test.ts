import { describe, expect, it } from "vitest";
import { findServiceDefinition, SERVICE_CATEGORIES } from "@/components/settings/add-account/services";

describe("add-account-services", () => {
  it("keeps enabled add account providers discoverable", () => {
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
    const disabledKinds = SERVICE_CATEGORIES.flatMap((category) =>
      category.services.filter((service) => service.disabled).map((service) => service.kind),
    );

    expect(disabledKinds).toEqual(["Fever", "Feedly"]);
  });
});
