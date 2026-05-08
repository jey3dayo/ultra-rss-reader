import { describe, expect, it, vi } from "vitest";
import { useActionsSettingsViewProps as buildActionsSettingsViewProps } from "@/components/settings/hooks/use-actions-settings-view-props";
import i18n from "@/lib/i18n";

const t = i18n.getFixedT("en", "settings");

describe("useActionsSettingsViewProps", () => {
  it("maps toolbar action preferences to service toggles", () => {
    const setPref = vi.fn();
    const props = buildActionsSettingsViewProps({
      t,
      prefs: { action_copy_link: "true" },
      setPref,
    });

    expect(props.services).toHaveLength(1);
    expect(props.services[0]).toEqual(
      expect.objectContaining({
        id: "action-copy-link",
        label: "Copy Link",
        checked: true,
      }),
    );

    props.services[0]?.onCheckedChange(false);

    expect(setPref).toHaveBeenCalledWith("action_copy_link", "false");
  });
});
