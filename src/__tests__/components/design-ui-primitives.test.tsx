import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";

const globalCss = readFileSync(join(process.cwd(), "src/styles/global.css"), "utf8");

describe("Design-themed UI primitives", () => {
  it("uses warm surface styling for shared button variants", () => {
    render(
      <>
        <Button>Primary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Delete</Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Primary" })).toHaveClass("bg-surface-3", "shadow-elevation-1");
    expect(screen.getByRole("button", { name: "Primary" })).toHaveClass("rounded-md");
    expect(screen.getByRole("button", { name: "Outline" })).toHaveClass("bg-surface-1", "border-border-strong");
    expect(screen.getByRole("button", { name: "Outline" })).toHaveClass("rounded-md");
    expect(screen.getByRole("button", { name: "Ghost" })).toHaveClass("text-foreground-soft");
    expect(screen.getByRole("button", { name: "Ghost" })).toHaveClass("rounded-md");
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass(
      "border-state-danger-border",
      "bg-state-danger-surface",
      "text-state-danger-foreground",
    );
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("rounded-md");
  });

  it("uses warm field surfaces for inputs and selects", () => {
    render(
      <>
        <Input aria-label="Feed URL" placeholder="https://example.com/feed.xml" />
        <Select value="dark" onValueChange={vi.fn()}>
          <SelectTrigger aria-label="Theme">
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
          </SelectPopup>
        </Select>
      </>,
    );

    expect(screen.getByRole("textbox", { name: "Feed URL" })).toHaveClass("bg-surface-1", "border-border");
    expect(screen.getByRole("combobox", { name: "Theme" })).toHaveClass("bg-surface-1", "border-border");
  });

  it("uses semantic danger borders for invalid field states", () => {
    render(
      <>
        <Input aria-label="Broken URL" aria-invalid={true} />
        <Select value="light" onValueChange={vi.fn()}>
          <SelectTrigger aria-label="Theme" aria-invalid={true}>
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            <SelectItem value="light">Light</SelectItem>
          </SelectPopup>
        </Select>
      </>,
    );

    expect(screen.getByRole("textbox", { name: "Broken URL" })).toHaveClass("aria-invalid:border-state-danger-border");
    expect(screen.getByRole("combobox", { name: "Theme" })).toHaveClass("aria-invalid:border-state-danger-border");
  });

  it("uses semantic success tokens for checked checkboxes", () => {
    render(<Checkbox aria-label="Keep selected" checked={true} onCheckedChange={vi.fn()} />);

    expect(screen.getByRole("checkbox", { name: "Keep selected" })).toHaveClass(
      "data-[checked]:border-state-success-border",
      "data-[checked]:bg-state-success-surface",
      "data-[checked]:text-state-success-foreground",
    );
  });

  it("renders dialogs with warm overlay and elevated surface styling", () => {
    render(
      <Dialog open={true} onOpenChange={vi.fn()}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Confirm</DialogTitle>
            <DialogDescription>Apply the warm theme</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    const overlay = document.querySelector('[data-slot="dialog-overlay"]');

    expect(overlay).toHaveClass("bg-dialog-overlay", "supports-backdrop-filter:backdrop-blur-sm");
    expect(globalCss).toContain("--color-dialog-overlay: var(--dialog-overlay);");
    expect(globalCss).toContain("--dialog-overlay: rgba(38, 37, 30, 0.18);");
    expect(globalCss).toContain(":root.dark {");
    expect(globalCss).toContain("--dialog-overlay: rgba(28, 25, 21, 0.6);");
    expect(screen.getByRole("dialog", { name: "Confirm" })).toHaveClass(
      "bg-surface-2",
      "border",
      "border-border",
      "shadow-elevation-3",
    );
  });

  it("uses the readable overlay token when requested", () => {
    render(
      <Dialog open={true} onOpenChange={vi.fn()}>
        <DialogContent showCloseButton={false} overlayPreset="readable">
          <DialogHeader>
            <DialogTitle>Readable dialog</DialogTitle>
            <DialogDescription>Use the softer readable scrim</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    const overlay = document.querySelector('[data-slot="dialog-overlay"]');

    expect(overlay).toHaveClass("bg-dialog-overlay-readable", "supports-backdrop-filter:backdrop-blur-none");
    expect(globalCss).toContain("--color-dialog-overlay-readable: var(--dialog-overlay-readable);");
    expect(globalCss).toContain("--dialog-overlay-readable: rgba(242, 241, 237, 0.6);");
    expect(globalCss).toContain("--dialog-overlay-readable: rgba(28, 25, 21, 0.72);");
  });
});
