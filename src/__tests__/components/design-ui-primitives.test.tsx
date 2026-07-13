import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { extractSortedUniqueRegistryMatches, sortedRegistryValues } from "@tests/helpers/design-registry";
import { describe, expect, it, vi } from "vitest";
import { CommandDialog } from "@/components/ui/command";
import {
  MOTION_ARTICLE_SLIDE_CLASS_NAME,
  MOTION_BUTTON_SURFACE_CLASS_NAME,
  MOTION_CLASS_NAMES,
  MOTION_CONTEXTUAL_SURFACE_CLASS_NAME,
  MOTION_DATA_ATTRIBUTES,
  MOTION_DATA_DIRECTION_ATTRIBUTE,
  MOTION_DIRECTION_NEXT,
  MOTION_DIRECTION_PREV,
  MOTION_DISCLOSURE_TRIGGER_CLASS_NAME,
  MOTION_GLOBAL_CSS_CONTRACT_SELECTORS,
  MOTION_KEYFRAMES_NAMES,
  MOTION_POPUP_DIALOG_CLASS_NAME,
  MOTION_POPUP_OVERLAY_CLASS_NAME,
} from "@/constants";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/design-system";

const globalCss = readFileSync(join(process.cwd(), "src/styles/global.css"), "utf8");
const motionCss = globalCss.slice(globalCss.indexOf("@keyframes vertical-wipe"), globalCss.indexOf("\n\nhtml,\nbody"));

const expectGlobalCssToContain = (...snippets: readonly string[]) => {
  for (const snippet of snippets) {
    expect(globalCss).toContain(snippet);
  }
};

const expectGlobalCssToContainMotionContract = () => {
  expect(extractSortedUniqueRegistryMatches(motionCss, /\.((?:motion|t)-[A-Za-z0-9_-]+|is-animating)\b/g)).toEqual(
    sortedRegistryValues(MOTION_CLASS_NAMES),
  );
  expect(extractSortedUniqueRegistryMatches(motionCss, /@keyframes ([A-Za-z0-9_-]+)/g)).toEqual(
    sortedRegistryValues(MOTION_KEYFRAMES_NAMES),
  );
  expect(extractSortedUniqueRegistryMatches(motionCss, /\[(data-[A-Za-z0-9_-]+)/g)).toEqual(
    sortedRegistryValues(MOTION_DATA_ATTRIBUTES),
  );

  for (const className of MOTION_CLASS_NAMES) {
    expectGlobalCssToContain(`.${className}`);
  }

  for (const keyframesName of MOTION_KEYFRAMES_NAMES) {
    expectGlobalCssToContain(`@keyframes ${keyframesName}`);
  }

  for (const dataAttribute of MOTION_DATA_ATTRIBUTES) {
    expectGlobalCssToContain(`[${dataAttribute}`);
  }

  for (const selector of MOTION_GLOBAL_CSS_CONTRACT_SELECTORS) {
    expectGlobalCssToContain(selector);
  }
};

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
    expect(screen.getByRole("button", { name: "Primary" })).toHaveClass(MOTION_BUTTON_SURFACE_CLASS_NAME);
    expect(screen.getByRole("button", { name: "Primary" })).toHaveClass("rounded-md");
    expect(screen.getByRole("button", { name: "Outline" })).toHaveClass("bg-surface-1", "border-border-strong");
    expect(screen.getByRole("button", { name: "Outline" })).toHaveClass("rounded-md");
    expect(screen.getByRole("button", { name: "Ghost" })).toHaveClass("text-foreground-soft");
    expect(screen.getByRole("button", { name: "Ghost" })).toHaveClass("focus-visible:border-transparent");
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
    expectGlobalCssToContain(
      "--motion-duration-disclosure: 200ms;",
      "--motion-duration-popup: 160ms;",
      "--motion-duration-resize: 260ms;",
      "--motion-duration-theme: 180ms;",
      "--motion-duration-contextual: 180ms;",
      "--motion-duration-content-swap: 180ms;",
      "--motion-ease-standard: cubic-bezier(0.22, 1, 0.36, 1);",
      "--motion-ease-emphasized: cubic-bezier(0.2, 0.8, 0.2, 1);",
    );
    expectGlobalCssToContainMotionContract();
    expectGlobalCssToContain("@starting-style", `.${MOTION_DISCLOSURE_TRIGGER_CLASS_NAME}:hover`);
    expect(globalCss).toContain(".motion-filter-toggle[data-pressed]");
    expect(globalCss).toContain("transform: translateY(-1px);");
    expect(globalCss).not.toContain(
      "box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-border-strong) 28%, transparent);",
    );
    expectGlobalCssToContain(
      "border-color: color-mix(in srgb, var(--color-border-strong) 28%, transparent);",
      `.${MOTION_CONTEXTUAL_SURFACE_CLASS_NAME}:focus-within`,
      "html.vertical-wipe-transition::view-transition-old(root)",
      "html.vertical-wipe-transition::view-transition-new(root)",
      "animation: vertical-wipe 0.75s ease-in-out forwards;",
      "will-change: clip-path;",
      "@media (prefers-reduced-motion: reduce)",
      `.${MOTION_ARTICLE_SLIDE_CLASS_NAME}[${MOTION_DATA_DIRECTION_ATTRIBUTE}="${MOTION_DIRECTION_NEXT}"],`,
      `.${MOTION_ARTICLE_SLIDE_CLASS_NAME}[${MOTION_DATA_DIRECTION_ATTRIBUTE}="${MOTION_DIRECTION_PREV}"],`,
    );
    expect(globalCss).not.toContain(":root.theme-transitioning body");
    expect(globalCss).not.toContain(
      "background-color, border-color, color, fill, stroke, box-shadow, text-decoration-color, outline-color",
    );
  });

  it("syncs OS contrast accessibility modes through shared design tokens", () => {
    expectGlobalCssToContain(
      "@media (prefers-contrast: more)",
      "--border: color-mix(in srgb, var(--foreground) 24%, transparent);",
      "--ring: color-mix(in srgb, var(--primary) 70%, var(--foreground));",
      "--browser-overlay-rail-border: color-mix(in srgb, var(--foreground) 32%, transparent);",
      "@media (forced-colors: active)",
      "--background: Canvas;",
      "--foreground: CanvasText;",
      "--primary: Highlight;",
      "--primary-foreground: HighlightText;",
      "--border: ButtonBorder;",
      "--ring: Highlight;",
      "--sidebar-selection-gradient: linear-gradient(90deg, Highlight 0%, Highlight 100%);",
      "--overlay-action-surface-focus: Highlight;",
      "--browser-overlay-state-detail-border: ButtonBorder;",
    );
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

    expect(overlay).toHaveClass("bg-dialog-overlay", "bg-dialog-scrim", "supports-backdrop-filter:backdrop-blur-sm");
    expect(overlay).toHaveClass(MOTION_POPUP_OVERLAY_CLASS_NAME);
    expectGlobalCssToContain(
      "--color-dialog-overlay: var(--dialog-overlay);",
      "--dialog-overlay: rgba(38, 37, 30, 0.18);",
      ":root.dark {",
      "--dialog-overlay: rgba(28, 25, 21, 0.6);",
    );
    expect(screen.getByRole("dialog", { name: "Confirm" })).toHaveClass(
      "bg-surface-2",
      "border",
      "border-border",
      "shadow-elevation-3",
    );
    expect(screen.getByRole("dialog", { name: "Confirm" })).toHaveClass(MOTION_POPUP_DIALOG_CLASS_NAME);
    expect(screen.getByRole("dialog", { name: "Confirm" })).toHaveClass(
      "focus-visible:border-border-strong",
      "focus-visible:ring-3",
      "focus-visible:ring-ring/50",
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

    expect(overlay).toHaveClass(
      "bg-dialog-overlay-readable",
      "bg-dialog-scrim-readable",
      "supports-backdrop-filter:backdrop-blur-none",
    );
    expectGlobalCssToContain(
      "--color-dialog-overlay-readable: var(--dialog-overlay-readable);",
      "--dialog-overlay-readable: rgba(242, 241, 237, 0.6);",
      "--dialog-overlay-readable: rgba(28, 25, 21, 0.72);",
    );
  });

  it("uses the readable scrim token for command palette dialogs", () => {
    render(
      <CommandDialog open={true} onOpenChange={vi.fn()} title="Command search" description="Find an action">
        <div>Command content</div>
      </CommandDialog>,
    );

    const overlay = document.querySelector('[data-slot="dialog-overlay"]');

    expect(screen.getByRole("dialog", { name: "Command search" })).toHaveTextContent("Command content");
    expect(overlay).toHaveClass(
      "bg-dialog-overlay-readable",
      "bg-dialog-scrim-readable",
      "supports-backdrop-filter:backdrop-blur-none",
    );
  });
});
