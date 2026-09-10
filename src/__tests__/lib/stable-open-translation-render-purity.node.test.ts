import { describe, expect, it } from "vitest";
import hookSource from "@/lib/i18n/use-stable-open-translation?raw";

// The defect this pins only appears when a concurrent render is discarded, which no
// sequential test can stage: both the old ref version and the current one keep the same
// locale under every commit order jsdom can produce, and the three locale-stability tests
// in the modal suites stayed green while the ref version was live. So the guard here is the
// shape, not the behavior — see docs/react-doctor-error-triage.md sections 13 and 14 for why
// a render-time write to this ref is observable past the render that made it.
describe("useStableOpenTranslation render purity", () => {
  it("captures the open locale outside render instead of writing a ref during render", () => {
    // A ref would be the reintroduction: the hook holds its open-locale state machine across
    // renders, so the capture has to be committed state, not something a discarded render can
    // leave behind.
    expect(hookSource).not.toContain("useRef");
    expect(hookSource).toContain("useLayoutEffect");
    expect(hookSource).toContain("useState<string | null>(null)");
  });
});
