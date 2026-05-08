import { describe, expect, it } from "vitest";
import i18n, { testI18nResourceNamespaces } from "../../../tests/helpers/i18n-setup";

describe("test i18n setup", () => {
  it("keeps test resource namespaces aligned with app-used namespaces", () => {
    const appUsedNamespaces = ["common", "settings", "reader", "sidebar", "subscriptions"] as const;

    expect(testI18nResourceNamespaces).toEqual(appUsedNamespaces);
    expect(i18n.options.ns).toEqual(appUsedNamespaces);
    expect(i18n.options.defaultNS).toBe("common");
    expect(appUsedNamespaces.every((namespace) => i18n.hasResourceBundle("en", namespace))).toBe(true);
  });
});
