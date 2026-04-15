import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";

describe("Design-themed UI primitives", () => {
  it("uses warm surface styling for shared button variants", () => {
    render(
      <>
        <Button>Primary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Primary" })).toHaveClass("bg-surface-3", "shadow-elevation-1");
    expect(screen.getByRole("button", { name: "Outline" })).toHaveClass("bg-surface-1", "border-border-strong");
    expect(screen.getByRole("button", { name: "Ghost" })).toHaveClass("text-foreground-soft");
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

    expect(screen.getByRole("dialog", { name: "Confirm" })).toHaveClass(
      "bg-surface-2",
      "border",
      "border-border",
      "shadow-elevation-3",
    );
  });
});
