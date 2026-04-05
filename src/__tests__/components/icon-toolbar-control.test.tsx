import { Menu } from "@base-ui/react/menu";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Globe } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { IconToolbarButton, IconToolbarMenuTrigger, IconToolbarToggle } from "@/components/shared/icon-toolbar-control";
import { TooltipProvider } from "@/components/ui/tooltip";

describe("IconToolbarControl", () => {
  it("renders a shared icon button with tooltip semantics and click handling", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <TooltipProvider>
        <IconToolbarButton label="Copy link" onClick={onClick}>
          <Globe className="h-4 w-4" />
        </IconToolbarButton>
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Copy link" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders a shared icon toggle with accent pressed styling", () => {
    render(
      <TooltipProvider>
        <IconToolbarToggle label="Close browser window" pressed={true} pressedTone="accent" onPressedChange={vi.fn()}>
          <Globe className="h-4 w-4" />
        </IconToolbarToggle>
      </TooltipProvider>,
    );

    expect(screen.getByRole("button", { name: "Close browser window" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Close browser window" })).toHaveClass("data-[pressed]:text-primary");
  });

  it("uses neutral pressed styling by default for shared toggles", () => {
    render(
      <TooltipProvider>
        <IconToolbarToggle label="Toggle read" pressed={true} onPressedChange={vi.fn()}>
          <Globe className="h-4 w-4" />
        </IconToolbarToggle>
      </TooltipProvider>,
    );

    expect(screen.getByRole("button", { name: "Toggle read" })).toHaveClass("data-[pressed]:text-foreground");
  });

  it("renders a shared icon menu trigger with tooltip semantics", async () => {
    const user = userEvent.setup();

    render(
      <TooltipProvider>
        <Menu.Root>
          <IconToolbarMenuTrigger label="Share">
            <Globe className="h-4 w-4" />
          </IconToolbarMenuTrigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>Copy link</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </TooltipProvider>,
    );

    const menuTrigger = screen.getByRole("button", { name: "Share" });
    expect(menuTrigger).toHaveClass("size-11", "md:size-8", "rounded-lg", "text-muted-foreground");

    await user.click(menuTrigger);

    expect(await screen.findByText("Copy link")).toBeInTheDocument();
  });
});
