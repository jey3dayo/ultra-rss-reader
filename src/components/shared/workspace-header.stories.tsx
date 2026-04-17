import { Controls, Primary, Subtitle, Title } from "@storybook/addon-docs/blocks";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { usePlatformStore } from "@/stores/platform-store";
import { WorkspaceHeader } from "./workspace-header";

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
    window.__DEV_BROWSER_MOCKS__ = true;
    window.__ULTRA_RSS_BROWSER_MOCKS__ = true;
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
  window.__DEV_BROWSER_MOCKS__ = false;
  window.__ULTRA_RSS_BROWSER_MOCKS__ = false;
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
  // Storybook docs/controls can render once before effects run. Apply the
  // runtime mode synchronously so the first frame matches the selected mode.
  applyRuntimeMode(runtimeMode);

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
    docs: {
      page: () => (
        <>
          <Title />
          <Subtitle>runtimeMode を切り替えて browser / mac / windows のヘッダー差分を確認します。</Subtitle>
          <Primary />
          <Controls />
        </>
      ),
    },
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
