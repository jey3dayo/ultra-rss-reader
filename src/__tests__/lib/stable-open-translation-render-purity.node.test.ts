import { describe, expect, it } from "vitest";
import hookSource from "@/lib/i18n/use-stable-open-translation?raw";

// This is the only automated guard on the fix. The defect appears only when a concurrent
// render is discarded, which no sequential test can stage — both the old ref version and the
// current one keep the same locale under every commit order jsdom can produce, and the three
// locale-stability tests in the modal suites stayed green while the ref version was live.
// React Doctor would catch a reintroduction, but neither CI nor the lefthook hooks run it, so
// nothing else here fails on revert. See docs/react-doctor-error-triage.md sections 13 and 14.
describe("useStableOpenTranslation render purity", () => {
  it("captures the open locale outside render instead of writing a ref during render", () => {
    // Assert on the write, not on the ref's constructor: `React.useRef`, an aliased import, or
    // a hand-rolled `{ current }` object would all pass a `useRef` name check while
    // reintroducing exactly the defect. Every one of them still needs a `.current =` write.
    // This hook has no legitimate reason to hold a mutable box at all — its open-locale state
    // machine spans renders, so the capture has to be committed state that a discarded render
    // cannot leave behind. If a later change needs a ref here, that is the decision to
    // re-examine, not this assertion to relax.
    expect(hookSource).not.toMatch(/\.current\s*=[^=]/);
    expect(hookSource).not.toMatch(/\buseRef\b/);
  });
});
