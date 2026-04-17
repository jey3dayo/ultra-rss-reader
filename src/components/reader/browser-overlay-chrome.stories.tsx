import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { BrowserOverlayChrome } from "./browser-overlay-chrome";
import type {
  BrowserOverlayActionsRenderer,
  BrowserOverlayChromeController,
  BrowserViewSurfacePresentation,
} from "./browser-view.types";

function createController(overrides?: Partial<BrowserOverlayChromeController>): BrowserOverlayChromeController {
  return {
    browserState: {
      url: "https://example.com/article",
      can_go_back: true,
      can_go_forward: false,
      is_loading: false,
    },
    geometry: {
      compact: false,
      ultraCompact: false,
      chromeRail: {
        visible: true,
        left: 0,
        right: 0,
        top: 0,
        height: 56,
      },
      stage: {
        left: 0,
        top: 56,
        right: 0,
        bottom: 0,
      },
      host: {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
      },
      chrome: {
        visualHeaderHeight: 56,
        leadingSafeInset: 72,
        leading: {
          left: 24,
          top: 12,
        },
        action: {
          right: 24,
          top: 12,
          size: 44,
        },
      },
      diagnostics: {
        compact: false,
        top: 64,
      },
    },
    handleCloseOverlay: fn(),
    handleGoBack: fn(async () => {}),
    handleGoForward: fn(async () => {}),
    handleReload: fn(async () => {}),
    handleOpenExternal: fn(async () => {}),
    ...overrides,
  };
}

function createPresentation(overrides?: Partial<BrowserViewSurfacePresentation>): BrowserViewSurfacePresentation {
  return {
    leadingActionSurface: {
      compact: true,
      tone: "default",
    },
    actionButtonSurface: {
      compact: true,
      tone: "default",
    },
    stageSurface: {
      scope: "main-stage",
    },
    ...overrides,
  };
}

type BrowserOverlayChromeStoryProps = {
  controller?: BrowserOverlayChromeController;
  presentation?: BrowserViewSurfacePresentation;
  closeWebPreviewLabel?: string;
  toolbarActions?: BrowserOverlayActionsRenderer;
};

function BrowserOverlayChromeStory({
  controller = createController(),
  presentation = createPresentation(),
  closeWebPreviewLabel = "Close Web Preview",
  toolbarActions,
}: BrowserOverlayChromeStoryProps) {
  return (
    <BrowserOverlayChrome
      controller={controller}
      presentation={presentation}
      closeWebPreviewLabel={closeWebPreviewLabel}
      toolbarActions={toolbarActions}
    />
  );
}

const meta = {
  title: "Reader/Browser/BrowserOverlayChrome",
  component: BrowserOverlayChromeStory,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="min-h-[220px] bg-background p-6 text-foreground dark:bg-[var(--browser-overlay-shell)]">
        <div className="relative h-[160px] overflow-hidden rounded-xl border border-border/35 bg-surface-1 dark:bg-surface-2">
          <div
            className="absolute inset-x-0 top-0 h-14 border-b border-border/25"
            style={{ backgroundImage: "var(--browser-overlay-rail)" }}
          />
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    controller: createController(),
    presentation: createPresentation(),
    closeWebPreviewLabel: "Close Web Preview",
  },
} satisfies Meta<typeof BrowserOverlayChromeStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const DisabledHistory: Story = {
  args: {
    controller: createController({
      browserState: {
        url: "https://example.com/article",
        can_go_back: false,
        can_go_forward: false,
        is_loading: false,
      },
    }),
  },
};

export const Compact: Story = {
  args: {
    controller: createController({
      geometry: {
        ...createController().geometry,
        compact: true,
        chrome: {
          ...createController().geometry.chrome,
          leading: {
            left: 16,
            top: 10,
          },
          action: {
            right: 16,
            top: 10,
            size: 44,
          },
        },
      },
    }),
  },
};
