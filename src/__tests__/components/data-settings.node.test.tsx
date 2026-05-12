import { render } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataSettings } from "@/components/settings/data-settings";

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
  setSettingsLoading: vi.fn(),
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
  useUiStore: (
    selector: (state: {
      showToast: typeof mocks.showToast;
      setSettingsLoading: typeof mocks.setSettingsLoading;
    }) => unknown,
  ) => selector({ showToast: mocks.showToast, setSettingsLoading: mocks.setSettingsLoading }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: unknown) => {
      mocks.translationCalls.push({ key, options });
      return key === "data.safety_checklist" ? ["safety"] : key;
    },
  }),
}));

setupBrowserTestDom();

describe("DataSettings", () => {
  beforeEach(() => {
    mocks.dataSettingsView.mockClear();
    mocks.useDataSettingsController.mockClear();
    mocks.showToast.mockClear();
    mocks.setSettingsLoading.mockClear();
    mocks.useRegisterSettingsDirtyState.mockClear();
    mocks.translationCalls.length = 0;
  });

  it("passes the localized data safety checklist without extra policy copy", () => {
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

  it("wires settings-wide loading into the data settings controller", () => {
    render(<DataSettings />);

    expect(mocks.useDataSettingsController).toHaveBeenCalledWith(
      expect.objectContaining({
        setSettingsLoading: mocks.setSettingsLoading,
      }),
    );
  });

  it("keeps action row labels stable while passing pending labels to actions", () => {
    mocks.useDataSettingsController.mockReturnValueOnce({
      databaseSizeStatus: "ready",
      databaseSizeValue: "1.0 KB",
      vacuuming: true,
      openingLogDir: true,
      handleVacuum: vi.fn(),
      handleOpenLogDir: vi.fn(),
    });

    render(<DataSettings />);

    expect(mocks.dataSettingsView).toHaveBeenCalledWith(
      expect.objectContaining({
        vacuumLabel: "data.vacuum",
        vacuumActionLabel: "data.vacuuming",
        openLogDirLabel: "data.open_log_dir",
        openLogDirActionLabel: "data.opening_log_dir",
      }),
    );
  });
});
