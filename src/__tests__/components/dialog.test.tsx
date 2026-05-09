import { render, screen } from "@testing-library/react";
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

  it("uses the provided footer close label", () => {
    renderDialogFooter({ closeLabel: "Close from footer" });

    expect(screen.getByRole("button", { name: "Close from footer" })).toBeInTheDocument();
  });

  it("uses the shared dialog close locale label in the footer", async () => {
    await i18n.changeLanguage("ja");

    renderDialogFooter();

    expect(screen.getByRole("button", { name: i18n.t("dialog_close") })).toBeInTheDocument();
  });
});
