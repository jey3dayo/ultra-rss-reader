import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChevronLeft, ExternalLink, RotateCw, X } from "lucide-react";
import { fn } from "storybook/test";
import { IconToolbarSurfaceButton } from "./icon-toolbar-control";

type IconToolbarSurfaceButtonStoryProps = {
  label?: string;
  disabled?: boolean;
  variant?: "default" | "chrome";
};

function IconToolbarSurfaceButtonStory({
  label = "Close Web Preview",
  disabled = false,
  variant = "default",
}: IconToolbarSurfaceButtonStoryProps) {
  return (
    <IconToolbarSurfaceButton label={label} onClick={fn()} disabled={disabled} variant={variant}>
      <X className="size-4" />
    </IconToolbarSurfaceButton>
  );
}

const meta = {
  title: "Shared/IconToolbarSurfaceButton",
  component: IconToolbarSurfaceButtonStory,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="min-h-[180px] bg-[#1f1b17] p-6 text-foreground">
        <div className="rounded-xl border border-border/35 bg-[#23201d] p-4">
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    label: "Close Web Preview",
    disabled: false,
    variant: "default",
  },
} satisfies Meta<typeof IconToolbarSurfaceButtonStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
  render: (args) => (
    <div className="flex items-center gap-3">
      <IconToolbarSurfaceButton
        label="Close Web Preview"
        onClick={fn()}
        disabled={args.disabled}
        variant={args.variant}
      >
        <X className="size-4" />
      </IconToolbarSurfaceButton>
      <IconToolbarSurfaceButton label="Web back" onClick={fn()} disabled={args.disabled} variant={args.variant}>
        <ChevronLeft className="size-4" />
      </IconToolbarSurfaceButton>
      <IconToolbarSurfaceButton label="Reload page" onClick={fn()} disabled={args.disabled} variant={args.variant}>
        <RotateCw className="size-4" />
      </IconToolbarSurfaceButton>
      <IconToolbarSurfaceButton
        label="Open in external browser"
        onClick={fn()}
        disabled={args.disabled}
        variant={args.variant}
      >
        <ExternalLink className="size-4" />
      </IconToolbarSurfaceButton>
    </div>
  ),
};

export const ChromeVariantComparison: Story = {
  args: {},
  render: () => (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-xs uppercase tracking-[0.18em] text-foreground/55">Default Surface</div>
        <div className="flex items-center gap-3">
          <IconToolbarSurfaceButton label="Close Web Preview" onClick={fn()}>
            <X className="size-4" />
          </IconToolbarSurfaceButton>
          <IconToolbarSurfaceButton label="Web back" onClick={fn()} disabled>
            <ChevronLeft className="size-4" />
          </IconToolbarSurfaceButton>
        </div>
      </div>
      <div>
        <div className="mb-2 text-xs uppercase tracking-[0.18em] text-foreground/55">Chrome Variant</div>
        <div className="flex items-center gap-3">
          <IconToolbarSurfaceButton label="Close Web Preview" onClick={fn()} variant="chrome">
            <X className="size-4" />
          </IconToolbarSurfaceButton>
          <IconToolbarSurfaceButton label="Web back" onClick={fn()} variant="chrome" disabled>
            <ChevronLeft className="size-4" />
          </IconToolbarSurfaceButton>
        </div>
      </div>
    </div>
  ),
};
