import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  AnnotatedNote,
  LeftBandShellSpecimen,
  MainContentShellSpecimen,
  ReferencePage,
  ShellExamplesSpecimen,
} from "@/components/storybook/ui-reference-canvas-specimens";

export function ShellOverlayCanvas() {
  return (
    <ReferencePage>
      <div className="space-y-6">
        <AnnotatedNote
          title="Shell & overlay"
          body="Outer frame patterns belong here. Use this canvas for rails, main content shells, dialogs, and context menu framing, not for generic section cards."
        />
        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <LeftBandShellSpecimen />
          <MainContentShellSpecimen>
            <div className="rounded-2xl border border-border/70 bg-surface-1/85 p-4 shadow-elevation-1">
              <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/58">
                Section containers stay inside
              </div>
              <p className="mt-2 font-serif text-sm leading-[1.45] text-foreground/72">
                The shell establishes the workspace boundary. Shared sections and helper notes should sit inside it
                instead of copying the shell radius language.
              </p>
            </div>
          </MainContentShellSpecimen>
        </div>
        <ShellExamplesSpecimen />
      </div>
    </ReferencePage>
  );
}

const meta = {
  title: "UI Reference/Shell & Overlay Canvas",
  component: ShellOverlayCanvas,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ShellOverlayCanvas>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
