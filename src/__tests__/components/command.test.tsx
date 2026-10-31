import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

describe("Command primitives", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("announces empty results without adding a status child to the listbox", async () => {
    const user = userEvent.setup();

    render(
      <Command>
        <CommandInput placeholder="Search commands" />
        <CommandList>
          <CommandItem value="open settings">Open settings</CommandItem>
        </CommandList>
        <CommandEmpty>No results found</CommandEmpty>
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
    expect(screen.getByRole("listbox")).not.toContainElement(status);
    expect(status.querySelector('[data-slot="command-empty"]')).toHaveClass("text-foreground-soft");

    await user.clear(screen.getByPlaceholderText("Search commands"));

    await waitFor(() => {
      expect(screen.queryByText("No results found")).not.toBeInTheDocument();
    });
  });

  it("keeps decorative result dividers out of the listbox accessibility tree", () => {
    render(
      <Command>
        <CommandList>
          <CommandItem>Open settings</CommandItem>
          <CommandSeparator />
          <CommandItem>Refresh feeds</CommandItem>
        </CommandList>
      </Command>,
    );

    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
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
