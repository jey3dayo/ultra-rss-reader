import { Menu } from "@base-ui/react/menu";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Globe } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import {
  IconToolbarButton,
  IconToolbarMenuTrigger,
  IconToolbarSurfaceButton,
  IconToolbarToggle,
  iconToolbarSurfaceButtonClassName,
  iconToolbarSurfaceControlVariants,
  iconToolbarSurfaceLabelButtonClassName,
} from "@/components/shared/icon-toolbar-control";
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

  it("renders tooltips with the shared popup motion surface", async () => {
    const user = userEvent.setup();

    render(
      <TooltipProvider>
        <IconToolbarButton label="Copy link" onClick={vi.fn()}>
          <Globe className="h-4 w-4" />
        </IconToolbarButton>
      </TooltipProvider>,
    );

    await user.hover(screen.getByRole("button", { name: "Copy link" }));

    expect(await screen.findByText("Copy link")).toHaveClass("motion-popup-surface");
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
    expect(menuTrigger).toHaveClass(
      "motion-interactive-surface",
      "size-11",
      "md:size-8",
      "rounded-md",
      "text-foreground-soft",
    );
    expect(menuTrigger).not.toHaveClass("text-muted-foreground");

    await user.click(menuTrigger);

    expect(await screen.findByText("Copy link")).toBeInTheDocument();
  });

  it("exports overlay-safe toolbar classes that preserve shared sizing and rounded corners", () => {
    expect(iconToolbarSurfaceButtonClassName).toContain("size-11");
    expect(iconToolbarSurfaceButtonClassName).toContain("md:size-8");
    expect(iconToolbarSurfaceButtonClassName).toContain("motion-interactive-surface");
    expect(iconToolbarSurfaceButtonClassName).toContain("rounded-lg");
    expect(iconToolbarSurfaceButtonClassName).toContain("text-inherit");
    expect(iconToolbarSurfaceButtonClassName).toContain("disabled:opacity-100");
    expect(iconToolbarSurfaceButtonClassName).toContain("disabled:text-foreground-soft");
    expect(iconToolbarSurfaceControlVariants({ pressedTone: "accent" })).toContain("data-[pressed]:text-primary");
    expect(iconToolbarSurfaceLabelButtonClassName).toContain("rounded-lg");
    expect(iconToolbarSurfaceLabelButtonClassName).toContain("motion-interactive-surface");
    expect(iconToolbarSurfaceLabelButtonClassName).toContain("text-inherit");
    expect(iconToolbarSurfaceLabelButtonClassName).toContain("disabled:text-foreground-soft");
  });

  it("renders a shared overlay surface button with the same icon treatment used by browser chrome", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <TooltipProvider>
        <IconToolbarSurfaceButton label="Close Web Preview" onClick={onClick}>
          <Globe className="h-4 w-4" />
        </IconToolbarSurfaceButton>
      </TooltipProvider>,
    );

    const button = screen.getByRole("button", { name: "Close Web Preview" });
    const surface = button.closest("[data-overlay-shell='action']");

    expect(surface).toHaveClass("motion-pressable-surface", "rounded-lg", "size-11", "md:size-8");
    expect(button).toHaveClass("rounded-lg");

    await user.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("supports a chrome variant for borderless browser chrome buttons", () => {
    render(
      <TooltipProvider>
        <IconToolbarSurfaceButton label="Web back" onClick={vi.fn()} variant="chrome">
          <Globe className="h-4 w-4" />
        </IconToolbarSurfaceButton>
      </TooltipProvider>,
    );

    const button = screen.getByRole("button", { name: "Web back" });
    const surface = button.closest("[data-overlay-shell='action']");

    expect(surface).toHaveClass("border-transparent", "bg-transparent", "shadow-none");
    expect(surface?.className).toContain("hover:bg-overlay-action-surface-chrome-hover");
    expect(surface?.className).toContain("has-[:active]:bg-overlay-action-surface-chrome-active");
  });
});
