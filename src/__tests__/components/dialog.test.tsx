import { act, render, screen } from "@testing-library/react";
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

  it("keeps background content hidden and inert while the modal dialog owns the top layer", () => {
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

    expect(screen.getByTestId("background-shell")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("background-shell")).toHaveAttribute("inert");
    expect(screen.getByRole("dialog", { name: "Test dialog" })).not.toHaveAttribute("aria-hidden");
    expect(screen.getByRole("dialog", { name: "Test dialog" })).not.toHaveAttribute("inert");
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
