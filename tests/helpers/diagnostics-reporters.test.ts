import { resetDiagnosticsReporterModuleGlobalsForTests } from "@tests/helpers/diagnostics-reporters";
import { describe, expect, it } from "vitest";

describe("diagnostics reporter test helper", () => {
  it.concurrent.each([0, 1, 2])("keeps diagnostics reporter resets idempotent for parallel test cleanup %#", () => {
    expect(() => resetDiagnosticsReporterModuleGlobalsForTests()).not.toThrow();
  });
});
