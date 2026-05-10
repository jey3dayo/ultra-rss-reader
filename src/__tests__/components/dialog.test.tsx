import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import i18n from "@/lib/i18n";

function renderDialogContent(props: Partial<React.ComponentProps<typeof DialogContent>> = {}) {
  render(
    <Dialog open>
      <DialogContent {...props}>
        <DialogTitle>Test dialog</DialogTitle>
      </DialogContent>
    </Dialog>,
  );
}

function renderDialogFooter(props: Partial<React.ComponentProps<typeof DialogFooter>> = {}) {
  render(
    <Dialog open>
      <DialogContent showCloseButton={false}>
        <DialogTitle>Test dialog</DialogTitle>
        <DialogFooter showCloseButton {...props} />
      </DialogContent>
    </Dialog>,
  );
}

describe("DialogContent", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("uses the provided close label as the accessible name", () => {
    renderDialogContent({ closeLabel: "Close custom dialog" });

    expect(screen.getByRole("button", { name: "Close custom dialog" })).toBeInTheDocument();
  });

  it("uses the shared dialog close locale label", async () => {
    await i18n.changeLanguage("ja");

    renderDialogContent();

    expect(screen.getByRole("button", { name: i18n.t("dialog_close") })).toBeInTheDocument();
  });

  it("updates the shared close label after a language change", async () => {
    renderDialogContent();

    expect(screen.getByRole("button", { name: "Close dialog" })).toBeInTheDocument();

    await act(async () => {
      await i18n.changeLanguage("ja");
    });

    expect(screen.getByRole("button", { name: "ダイアログを閉じる" })).toBeInTheDocument();
  });

  it("uses the provided footer close label", () => {
    renderDialogFooter({ closeLabel: "Close from footer" });

    expect(screen.getByRole("button", { name: "Close from footer" })).toBeInTheDocument();
  });

  it("keeps dialog overlay and content on the shared modal stack layer", () => {
    renderDialogContent();

    expect(document.querySelector('[data-slot="dialog-overlay"]')).toHaveClass("z-50");
    expect(screen.getByRole("dialog", { name: "Test dialog" })).toHaveClass("z-50");
    expect(screen.getByRole("dialog", { name: "Test dialog" })).toHaveAttribute("data-stack-layer", "dialog");
  });

  it("keeps background content hidden and inert while the modal dialog owns the top layer", async () => {
    render(
      <>
        <main data-testid="background-shell">
          <button type="button">Background action</button>
        </main>
        <Dialog open>
          <DialogContent>
            <DialogTitle>Test dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      </>,
    );

    await waitFor(() => {
      const hiddenBackgroundRoot = screen.getByTestId("background-shell").closest("[aria-hidden='true']");
      expect(hiddenBackgroundRoot).toHaveAttribute("aria-hidden", "true");
      expect(hiddenBackgroundRoot).toHaveAttribute("inert");
    });
    expect(screen.getByRole("dialog", { name: "Test dialog" })).not.toHaveAttribute("aria-hidden");
    expect(screen.getByRole("dialog", { name: "Test dialog" })).not.toHaveAttribute("inert");
  });

  it("restores only the top dialog layer while keeping background hidden for the remaining modal", async () => {
    const { rerender } = render(
      <>
        <main data-testid="background-shell">
          <button type="button">Background action</button>
        </main>
        <Dialog open>
          <DialogContent>
            <DialogTitle>Outer dialog</DialogTitle>
          </DialogContent>
        </Dialog>
        <Dialog open>
          <DialogContent>
            <DialogTitle>Inner dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      </>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("background-shell").closest("[aria-hidden='true']")).toHaveAttribute("inert");
    });

    rerender(
      <>
        <main data-testid="background-shell">
          <button type="button">Background action</button>
        </main>
        <Dialog open>
          <DialogContent>
            <DialogTitle>Outer dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      </>,
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Inner dialog" })).not.toBeInTheDocument();
      expect(screen.getByTestId("background-shell").closest("[aria-hidden='true']")).toHaveAttribute("inert");
    });
    expect(screen.getByRole("dialog", { name: "Outer dialog" })).not.toHaveAttribute("aria-hidden");
    expect(screen.getByRole("dialog", { name: "Outer dialog" })).not.toHaveAttribute("inert");
  });

  it("keeps a modal dialog above command and popover surfaces and hides the lower top layer", async () => {
    render(
      <>
        <div data-testid="command-popover-surface" data-stack-layer="commandPalette">
          <button type="button">Run command</button>
        </div>
        <Dialog open>
          <DialogContent>
            <DialogTitle>Settings modal</DialogTitle>
            <button type="button">Save settings</button>
          </DialogContent>
        </Dialog>
      </>,
    );

    await waitFor(() => {
      const hiddenCommandLayer = screen.getByTestId("command-popover-surface").closest("[aria-hidden='true']");
      expect(hiddenCommandLayer).toHaveAttribute("data-base-ui-inert");
    });

    expect(screen.getByTestId("command-popover-surface")).toHaveAttribute("data-stack-layer", "commandPalette");
    expect(screen.getByRole("dialog", { name: "Settings modal" })).toHaveAttribute("data-stack-layer", "dialog");
    expect(screen.getByRole("dialog", { name: "Settings modal" })).not.toHaveAttribute("aria-hidden");
    expect(screen.getByRole("dialog", { name: "Settings modal" })).not.toHaveAttribute("inert");
  });

  it("traps Tab navigation inside the active modal dialog", async () => {
    const user = userEvent.setup();

    render(
      <>
        <button type="button">Background action</button>
        <Dialog open>
          <DialogContent>
            <DialogTitle>Keyboard dialog</DialogTitle>
            <button type="button">First action</button>
            <button type="button">Second action</button>
          </DialogContent>
        </Dialog>
      </>,
    );

    const firstAction = screen.getByRole("button", { name: "First action" });
    const _secondAction = screen.getByRole("button", { name: "Second action" });
    const closeAction = screen.getByRole("button", { name: "Close dialog" });
    const backgroundAction = screen.getByRole("button", { name: "Background action", hidden: true });

    firstAction.focus();
    expect(firstAction).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("dialog", { name: "Keyboard dialog" })).toContainElement(document.activeElement);

    closeAction.focus();
    expect(closeAction).toHaveFocus();

    await user.tab();
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    expect(
      screen.getByRole("dialog", { name: "Keyboard dialog" }).contains(activeElement) ||
        activeElement?.hasAttribute("data-base-ui-focus-guard"),
    ).toBe(true);
    expect(backgroundAction).not.toHaveFocus();
  });

  it("hides the browser overlay root while a modal dialog owns the top layer", async () => {
    render(
      <>
        <main data-testid="reader-shell">
          <button type="button">Reader action</button>
        </main>
        <div data-browser-overlay-root="" data-testid="browser-overlay-root">
          <button type="button">Browser action</button>
        </div>
        <Dialog open>
          <DialogContent>
            <DialogTitle>Settings modal</DialogTitle>
          </DialogContent>
        </Dialog>
      </>,
    );

    await waitFor(() => {
      const hiddenBrowserLayer = screen.getByTestId("browser-overlay-root").closest("[aria-hidden='true']");
      expect(hiddenBrowserLayer).toHaveAttribute("inert");
    });
    expect(screen.getByTestId("reader-shell").closest("[aria-hidden='true']")).toHaveAttribute("inert");
    expect(screen.getByRole("dialog", { name: "Settings modal" })).not.toHaveAttribute("aria-hidden");
    expect(screen.getByRole("dialog", { name: "Settings modal" })).not.toHaveAttribute("inert");
  });

  it("keeps the trap-focus escape hatch from hiding sibling top-layer surfaces", () => {
    render(
      <>
        <main data-testid="background-shell">
          <button type="button">Background action</button>
        </main>
        <div data-browser-overlay-root="" data-testid="browser-overlay-root" />
        <Dialog open modal="trap-focus">
          <DialogContent stackLayer="commandPalette">
            <DialogTitle>Test dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      </>,
    );

    expect(screen.getByTestId("background-shell")).not.toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("background-shell")).not.toHaveAttribute("inert");
    expect(screen.getByTestId("browser-overlay-root")).not.toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("browser-overlay-root")).not.toHaveAttribute("inert");
    expect(screen.getByRole("dialog", { name: "Test dialog" })).toHaveAttribute("data-stack-layer", "commandPalette");
  });

  it("uses the shared dialog close locale label in the footer", async () => {
    await i18n.changeLanguage("ja");

    renderDialogFooter();

    expect(screen.getByRole("button", { name: i18n.t("dialog_close") })).toBeInTheDocument();
  });

  it("updates the shared footer close label after a language change", async () => {
    renderDialogFooter();

    expect(screen.getByRole("button", { name: "Close dialog" })).toBeInTheDocument();

    await act(async () => {
      await i18n.changeLanguage("ja");
    });

    expect(screen.getByRole("button", { name: "ダイアログを閉じる" })).toBeInTheDocument();
  });
});
