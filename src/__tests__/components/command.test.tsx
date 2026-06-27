import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command, CommandDialog, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

describe("Command primitives", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("exposes CommandEmpty as a polite status region only when filtered results are empty", async () => {
    const user = userEvent.setup();

    render(
      <Command>
        <CommandInput placeholder="Search commands" />
        <CommandList>
          <CommandItem value="open settings">Open settings</CommandItem>
          <CommandEmpty>No results found</CommandEmpty>
        </CommandList>
      </Command>,
    );

    expect(screen.getByRole("option", { name: "Open settings" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search commands")).toHaveClass("h-11");
    expect(screen.getByPlaceholderText("Search commands").closest('[data-slot="command-input-wrapper"]')).toHaveClass(
      "h-11",
    );

    await user.type(screen.getByPlaceholderText("Search commands"), "missing");

    const status = await screen.findByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("No results found");
    expect(status.querySelector('[data-slot="command-empty"]')).toHaveClass("text-foreground-soft");

    await user.clear(screen.getByPlaceholderText("Search commands"));

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  it("exposes CommandDialog title and description through the dialog role", () => {
    render(
      <CommandDialog open={true} onOpenChange={vi.fn()} title="Run command" description="Choose an action.">
        <CommandInput placeholder="Search commands" />
      </CommandDialog>,
    );

    expect(screen.getByRole("dialog", { name: "Run command", description: "Choose an action." })).toContainElement(
      screen.getByPlaceholderText("Search commands"),
    );
    expect(screen.getByRole("dialog", { name: "Run command" })).toHaveAttribute("data-stack-layer", "commandPalette");
    expect(screen.getByRole("dialog", { name: "Run command" })).toHaveClass("z-50");
    expect(screen.getByPlaceholderText("Search commands")).toHaveClass("h-11");
  });
});
