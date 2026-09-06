import { act, render } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { mockObserverConstructors } from "@tests/helpers/typed-test-factories";
import { useCallback } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  useReaderPassiveLayoutBodyRef,
  useReaderPassiveLayoutCard,
} from "@/components/reader/hooks/use-reader-passive-layout-context";
import { ReaderPassiveLayoutProvider } from "@/components/reader/reader-passive-layout";

setupBrowserTestDom();

let cleanupObserverMocks: (() => void) | null = null;

function mockLayoutObservers() {
  const mocks = mockObserverConstructors();
  cleanupObserverMocks = mocks.cleanupObservers;
  return mocks;
}

function setBounds(element: HTMLElement, top: number, bottom: number) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    top,
    bottom,
    height: bottom - top,
    left: 0,
    right: 0,
    width: 0,
    x: 0,
    y: top,
    toJSON: () => ({}),
  });
}

afterEach(() => {
  cleanupObserverMocks?.();
  cleanupObserverMocks = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/**
 * Mirrors the real reader wiring end to end: a body viewport and a passive card registered
 * through the *context* hooks (not the bare `useReaderPassiveLayout` hook directly), inside a
 * real `ReaderPassiveLayoutProvider`. This is the seam the 2026-09-07 production regression
 * escaped through: `use-reader-passive-layout.node.test.tsx` calls `registerBody`/`registerCard`
 * directly and can never see a ref-callback identity churn caused by the context consumer hooks,
 * because it never renders a context consumer.
 */
function TestPane({
  paneId,
  identityKey,
  bodyTop,
  bodyBottom,
  cardHeight,
  attachCounter,
}: {
  paneId: "list" | "content";
  identityKey: string;
  bodyTop: number;
  bodyBottom: number;
  cardHeight: number;
  attachCounter: { body: number; card: number };
}) {
  const bodyRef = useReaderPassiveLayoutBodyRef(paneId);
  const passiveCard = useReaderPassiveLayoutCard(paneId, identityKey);

  // useCallback here so this test's own wrapper ref stays stable across re-renders and only
  // reflects churn coming from bodyRef/passiveCard.cardRef -- an inline ref prop would get a new
  // identity (and force React to detach/reattach) on every render regardless of the hooks' own
  // stability, which would make this test measure its own scaffolding instead of the library.
  const bodyElementRef = useCallback(
    (element: HTMLDivElement | null) => {
      if (element) {
        setBounds(element, bodyTop, bodyBottom);
        attachCounter.body += 1;
      }
      bodyRef(element);
    },
    [bodyRef, bodyTop, bodyBottom, attachCounter],
  );
  const cardElementRef = useCallback(
    (element: HTMLDivElement | null) => {
      if (element) {
        setBounds(element, 0, cardHeight);
        attachCounter.card += 1;
      }
      passiveCard.cardRef(element);
    },
    [passiveCard.cardRef, cardHeight, attachCounter],
  );

  return (
    <div data-testid={`${paneId}-body`} ref={bodyElementRef}>
      <div
        data-testid={`${paneId}-card`}
        data-passive-layout-mode={passiveCard.mode}
        style={{ marginTop: passiveCard.offsetPx }}
        ref={cardElementRef}
      />
    </div>
  );
}

describe("useReaderPassiveLayoutBodyRef / useReaderPassiveLayoutCard (context integration)", () => {
  it("settles to a stable registration after the first measurement instead of detaching/re-attaching forever", () => {
    mockLayoutObservers();
    const rafCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });

    const listAttach = { body: 0, card: 0 };
    const contentAttach = { body: 0, card: 0 };

    render(
      <ReaderPassiveLayoutProvider layoutMode="wide" visiblePanes={["list", "content"]}>
        <TestPane
          paneId="list"
          identityKey="list-empty"
          bodyTop={0}
          bodyBottom={1000}
          cardHeight={100}
          attachCounter={listAttach}
        />
        <TestPane
          paneId="content"
          identityKey="summary"
          bodyTop={0}
          bodyBottom={1000}
          cardHeight={100}
          attachCounter={contentAttach}
        />
      </ReaderPassiveLayoutProvider>,
    );

    // First measurement pass: resolves the registered geometry into cardStates.
    act(() => {
      rafCallbacks[rafCallbacks.length - 1]?.(0);
    });

    const listAttachAfterFirstMeasure = listAttach.body;
    const contentAttachAfterFirstMeasure = contentAttach.body;

    // A regressed build detaches/re-attaches every ref on every cardStates update (a new context
    // object identity), which schedules another rAF; flushing a couple more frames must NOT grow
    // the attach counts further once the geometry itself is unchanged.
    act(() => {
      rafCallbacks[rafCallbacks.length - 1]?.(0);
    });
    act(() => {
      rafCallbacks[rafCallbacks.length - 1]?.(0);
    });

    expect(listAttach.body).toBe(listAttachAfterFirstMeasure);
    expect(contentAttach.body).toBe(contentAttachAfterFirstMeasure);
    expect(listAttach.card).toBe(1);
    expect(contentAttach.card).toBe(1);
  });

  it("propagates a real measurement to the DOM (mode/offset), not the unmeasured default", () => {
    mockLayoutObservers();
    const rafCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });

    const listAttach = { body: 0, card: 0 };
    const contentAttach = { body: 0, card: 0 };

    const { getByTestId } = render(
      <ReaderPassiveLayoutProvider layoutMode="wide" visiblePanes={["list", "content"]}>
        <TestPane
          paneId="list"
          identityKey="list-empty"
          bodyTop={0}
          bodyBottom={1000}
          cardHeight={100}
          attachCounter={listAttach}
        />
        <TestPane
          paneId="content"
          identityKey="summary"
          bodyTop={0}
          bodyBottom={1000}
          cardHeight={100}
          attachCounter={contentAttach}
        />
      </ReaderPassiveLayoutProvider>,
    );

    act(() => {
      rafCallbacks[rafCallbacks.length - 1]?.(0);
    });
    // Flush a settle-confirmation pass: if the regression were present, this is where a churned
    // registration would still be resetting cardStates back to an empty/unmeasured default.
    act(() => {
      rafCallbacks[rafCallbacks.length - 1]?.(0);
    });

    const listCard = getByTestId("list-card");
    const contentCard = getByTestId("content-card");

    // H = 1000, Y = clamp(24, 250, 976) = 250; both cards (height 100) fit comfortably under it.
    expect(listCard.getAttribute("data-passive-layout-mode")).toBe("normal");
    expect(contentCard.getAttribute("data-passive-layout-mode")).toBe("normal");
    expect(listCard.style.marginTop).toBe("250px");
    expect(contentCard.style.marginTop).toBe("250px");
  });
});
