import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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

describe("DialogContent", () => {
  it("uses the provided close label as the accessible name", () => {
    renderDialogContent({ closeLabel: "Close custom dialog" });

    expect(screen.getByRole("button", { name: "Close custom dialog" })).toBeInTheDocument();
  });

  it("falls back to the common close locale label", async () => {
    await i18n.changeLanguage("ja");

    renderDialogContent();

    expect(screen.getByRole("button", { name: i18n.t("close") })).toBeInTheDocument();
  });
});
