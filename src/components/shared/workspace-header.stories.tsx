import type { Meta, StoryObj } from "@storybook/react-vite";
import { useLayoutEffect } from "react";
import { fn } from "storybook/test";
import { WorkspaceHeader } from "./workspace-header";
import { usePlatformStore } from "@/stores/platform-store";

type RuntimeMode = "browser" | "mac" | "windows";

type WorkspaceHeaderStoryProps = {
  runtimeMode: RuntimeMode;
  eyebrow: string;
  title: string;
  subtitle: string;
  backLabel: string;
  closeLabel: string;
};

const runtimeCapabilities = {
  supports_reading_list: false,
  supports_background_browser_open: false,
  supports_runtime_window_icon_replacement: true,
  supports_native_browser_navigation: true,
  uses_dev_file_credentials: false,
};

function applyRuntimeMode(runtimeMode: RuntimeMode) {
  if (runtimeMode === "browser") {
    delete window.__TAURI_INTERNALS__;
    usePlatformStore.setState({
      platform: {
        kind: "unknown",
        capabilities: runtimeCapabilities,
      },
      loaded: true,
      loadError: false,
      inFlightLoad: null,
    });
    return;
  }

  window.__TAURI_INTERNALS__ = {} as typeof window.__TAURI_INTERNALS__;
  usePlatformStore.setState({
    platform: {
      kind: runtimeMode === "mac" ? "macos" : "windows",
      capabilities: runtimeCapabilities,
    },
    loaded: true,
    loadError: false,
    inFlightLoad: null,
  });
}

function WorkspaceHeaderStory({
  runtimeMode,
  eyebrow,
  title,
  subtitle,
  backLabel,
  closeLabel,
}: WorkspaceHeaderStoryProps) {
  useLayoutEffect(() => {
    const previousPlatformState = usePlatformStore.getState();
    const previousTauriInternals = window.__TAURI_INTERNALS__;

    applyRuntimeMode(runtimeMode);

    return () => {
      if (previousTauriInternals == null) {
        delete window.__TAURI_INTERNALS__;
      } else {
        window.__TAURI_INTERNALS__ = previousTauriInternals;
      }
      usePlatformStore.setState(previousPlatformState);
    };
  }, [runtimeMode]);

  return (
    <WorkspaceHeader
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      backLabel={backLabel}
      onBack={fn()}
      closeLabel={closeLabel}
      onClose={fn()}
      actions={
        <button
          type="button"
          className="h-7 rounded-[min(var(--radius-md),12px)] border border-border/60 px-2.5 text-[0.8rem] text-foreground-soft"
        >
          ショートカット
        </button>
      }
    />
  );
}

const meta = {
  title: "Shared/WorkspaceHeader",
  component: WorkspaceHeaderStory,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div className="min-h-[320px] bg-background text-foreground">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    runtimeMode: {
      control: "inline-radio",
      options: ["browser", "mac", "windows"],
    },
  },
  args: {
    runtimeMode: "browser",
    eyebrow: "TRIAGE",
    title: "購読の整理",
    subtitle: "動きの少ない購読を見直します。",
    backLabel: "戻る",
    closeLabel: "閉じる",
  },
} satisfies Meta<typeof WorkspaceHeaderStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const BrowserPreview: Story = {
  args: {
    runtimeMode: "browser",
  },
};

export const MacDesktop: Story = {
  args: {
    runtimeMode: "mac",
  },
};

export const WindowsDesktop: Story = {
  args: {
    runtimeMode: "windows",
  },
};
