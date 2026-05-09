import { describe, expect, expectTypeOf, it, vi } from "vitest";
import type { MuteKeywordScope } from "@/api/schemas";
import type { MuteKeywordDto } from "@/api/tauri-commands";
import { useMuteSettingsViewProps as buildMuteSettingsViewProps } from "@/components/settings/hooks/use-mute-settings-view-props";
import type { MuteSettingsViewProps } from "@/components/settings/mute-settings-view";
import i18n from "@/lib/i18n";

const t = i18n.getFixedT("en", "settings");

const rule: MuteKeywordDto = {
  id: "mute-1",
  keyword: "spoiler",
  scope: "title_and_body",
  created_at: "2026-04-30T00:00:00.000Z",
  updated_at: "2026-04-30T00:00:00.000Z",
};

function createProps(
  overrides: Partial<Parameters<typeof buildMuteSettingsViewProps>[0]> = {},
) {
  return buildMuteSettingsViewProps({
    t,
    keyword: "spoiler",
    scope: "title",
    rules: [rule],
    addDisabled: false,
    autoMarkReadChecked: true,
    autoMarkReadDisabled: false,
    confirmRule: null,
    onKeywordChange: vi.fn(),
    onScopeChange: vi.fn(),
    onRuleScopeChange: vi.fn(),
    onAutoMarkReadChange: vi.fn(),
    onAdd: vi.fn(),
    onRequestDelete: vi.fn(),
    onConfirmDelete: vi.fn(),
    onCancelDelete: vi.fn(),
    ...overrides,
  });
}

describe("useMuteSettingsViewProps", () => {
  it("keeps mute option and keyword row models view-local", () => {
    expectTypeOf<
      MuteSettingsViewProps["scopeOptions"][number]
    >().toEqualTypeOf<{
      value: MuteKeywordScope;
      label: string;
    }>();
    expectTypeOf<MuteSettingsViewProps["rules"][number]>().toEqualTypeOf<{
      id: string;
      keyword: string;
      scope: MuteKeywordScope;
    }>();
  });

  it("maps scope options and saved rules", () => {
    const props = createProps();

    expect(props.scopeOptions).toEqual([
      { value: "title", label: "Title" },
      { value: "body", label: "Body" },
      { value: "title_and_body", label: "Title and body" },
    ]);
    expect(props.rules).toEqual([
      { id: "mute-1", keyword: "spoiler", scope: "title_and_body" },
    ]);
    expect(props.savedScopeAriaLabel("spoiler")).toBe("Scope for spoiler");
  });

  it("maps callbacks through to view props", () => {
    const onRuleScopeChange = vi.fn();
    const onAutoMarkReadChange = vi.fn();
    const props = createProps({ onRuleScopeChange, onAutoMarkReadChange });

    props.onRuleScopeChange("mute-1", "body");
    props.onAutoMarkReadChange(false);

    expect(onRuleScopeChange).toHaveBeenCalledWith("mute-1", "body");
    expect(onAutoMarkReadChange).toHaveBeenCalledWith(false);
  });

  it("builds confirmation copy from the pending rule scope", () => {
    const props = createProps({ confirmRule: rule });

    expect(props.confirmOpen).toBe(true);
    expect(props.confirmMessage).toContain("spoiler");
    expect(props.confirmMessage).toContain("Title and body");
  });
});
