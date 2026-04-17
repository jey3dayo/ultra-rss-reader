import type { Meta, StoryObj } from "@storybook/react-vite";
import { createRef } from "react";
import { fn } from "storybook/test";
import { BrowserOverlayChrome } from "./browser-overlay-chrome";
import { BrowserOverlayStage } from "./browser-overlay-stage";
import type {
  BrowserOverlayChromeController,
  BrowserOverlayStageController,
  BrowserViewGeometry,
  BrowserViewSurfacePresentation,
} from "./browser-view.types";

function createGeometry(): BrowserViewGeometry {
  return {
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
  };
}

function createPresentation(): BrowserViewSurfacePresentation {
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
  };
}

function createChromeController(overrides?: Partial<BrowserOverlayChromeController>): BrowserOverlayChromeController {
  return {
    browserState: {
      url: "https://example.com/article",
      can_go_back: true,
      can_go_forward: false,
      is_loading: true,
    },
    geometry: createGeometry(),
    handleCloseOverlay: fn(),
    handleGoBack: fn(async () => {}),
    handleGoForward: fn(async () => {}),
    handleReload: fn(async () => {}),
    handleOpenExternal: fn(async () => {}),
    ...overrides,
  };
}

function createStageController(overrides?: Partial<BrowserOverlayStageController>): BrowserOverlayStageController {
  return {
    stageRef: createRef<HTMLDivElement>(),
    hostRef: createRef<HTMLDivElement>(),
    presentation: createPresentation(),
    geometry: createGeometry(),
    isLoading: true,
    activeSurfaceIssue: null,
    showDiagnostics: false,
    handleRetry: fn(),
    handleOpenExternal: fn(async () => {}),
    ...overrides,
  };
}

type BrowserOverlayStageStoryProps = {
  chromeController?: BrowserOverlayChromeController;
  stageController?: BrowserOverlayStageController;
  presentation?: BrowserViewSurfacePresentation;
  closeWebPreviewLabel?: string;
};

function BrowserOverlayStageStory({
  chromeController = createChromeController(),
  stageController = createStageController(),
  presentation = createPresentation(),
  closeWebPreviewLabel = "Close Web Preview",
}: BrowserOverlayStageStoryProps) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--browser-overlay-shell)] text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "var(--browser-overlay-shell-veil)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute z-[50] rounded-none border-b backdrop-blur-md"
        style={{
          left: `${chromeController.geometry.chromeRail.left}px`,
          right: `${chromeController.geometry.chromeRail.right}px`,
          top: `${chromeController.geometry.chromeRail.top}px`,
          height: `${chromeController.geometry.chromeRail.height}px`,
          backgroundImage: "var(--browser-overlay-rail)",
          borderColor: "var(--color-browser-overlay-rail-border)",
        }}
      />
      <BrowserOverlayChrome
        controller={chromeController}
        presentation={presentation}
        closeWebPreviewLabel={closeWebPreviewLabel}
      />
      <BrowserOverlayStage controller={stageController} />
    </div>
  );
}

const meta = {
  title: "Reader/BrowserOverlayStage",
  component: BrowserOverlayStageStory,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Browser overlay shell chrome and stage overlays. Use this to review shell-role framing separately from loading and issue state overlays.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="min-h-[320px] bg-background p-6 text-foreground dark:bg-[var(--browser-overlay-shell)]">
        <div className="relative h-[220px] overflow-hidden rounded-xl border border-border/35 bg-surface-1 dark:bg-surface-2">
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    chromeController: createChromeController(),
    stageController: createStageController(),
    presentation: createPresentation(),
    closeWebPreviewLabel: "Close Web Preview",
  },
} satisfies Meta<typeof BrowserOverlayStageStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {};

export const Loaded: Story = {
  args: {
    chromeController: createChromeController({
      browserState: {
        url: "https://example.com/article",
        can_go_back: true,
        can_go_forward: false,
        is_loading: false,
      },
    }),
    stageController: createStageController({
      isLoading: false,
    }),
  },
};
