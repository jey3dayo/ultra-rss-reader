import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataSettings } from "@/components/settings/data-settings";
import { STORAGE_CLEANUP_POLICY_CONNECTIONS } from "@/constants/storage";

const mocks = vi.hoisted(() => ({
  dataSettingsView: vi.fn<(props: unknown) => null>(() => null),
  useDataSettingsController: vi.fn((_params: unknown) => ({
    databaseSizeStatus: "ready",
    databaseSizeValue: "1.0 KB",
    vacuuming: false,
    openingLogDir: false,
    handleVacuum: vi.fn(),
    handleOpenLogDir: vi.fn(),
  })),
  showToast: vi.fn(),
  useRegisterSettingsDirtyState: vi.fn(),
  translationCalls: [] as { key: string; options: unknown }[],
}));

vi.mock("@/components/settings/data-settings-view", () => ({
  DataSettingsView: (props: unknown) => mocks.dataSettingsView(props),
}));

vi.mock("@/components/settings/hooks/use-data-settings-controller", () => ({
  useDataSettingsController: (params: unknown) => mocks.useDataSettingsController(params),
}));

vi.mock("@/components/settings/hooks/use-settings-dirty-state-registry", () => ({
  useRegisterSettingsDirtyState: (entry: unknown) => mocks.useRegisterSettingsDirtyState(entry),
}));

vi.mock("@/stores/ui-store", () => ({
  useUiStore: (selector: (state: { showToast: typeof mocks.showToast }) => unknown) =>
    selector({ showToast: mocks.showToast }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: unknown) => {
      mocks.translationCalls.push({ key, options });
      return key === "data.safety_checklist" ? ["safety"] : key;
    },
  }),
}));

describe("DataSettings", () => {
  beforeEach(() => {
    mocks.dataSettingsView.mockClear();
    mocks.useDataSettingsController.mockClear();
    mocks.showToast.mockClear();
    mocks.useRegisterSettingsDirtyState.mockClear();
    mocks.translationCalls.length = 0;
  });

  it("passes storage cleanup policy connections into the data safety checklist translation", () => {
    render(<DataSettings />);

    expect(mocks.dataSettingsView).toHaveBeenCalledWith(
      expect.objectContaining({
        safetyChecklist: ["safety"],
      }),
    );
    expect(mocks.translationCalls).toContainEqual({
      key: "data.safety_checklist",
      options: {
        returnObjects: true,
        settingsDataResetStorageKeys: STORAGE_CLEANUP_POLICY_CONNECTIONS.settingsDataResetKeys,
        privateDataExportStorageKeys: STORAGE_CLEANUP_POLICY_CONNECTIONS.privateDataExportKeys,
      },
    });
  });

  it("registers pending data actions as settings dirty-state blockers", () => {
    mocks.useDataSettingsController.mockReturnValueOnce({
      databaseSizeStatus: "ready",
      databaseSizeValue: "1.0 KB",
      vacuuming: true,
      openingLogDir: false,
      handleVacuum: vi.fn(),
      handleOpenLogDir: vi.fn(),
    });

    render(<DataSettings />);

    expect(mocks.useRegisterSettingsDirtyState).toHaveBeenCalledWith({
      owner: "data",
      dirty: false,
      pending: true,
      blockingReason: "data-action-pending",
    });
  });
});
