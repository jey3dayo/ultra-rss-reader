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
            <AnnotatedNote
              title="Section containers stay inside"
              body="The shell establishes the workspace boundary. Shared sections and helper notes should sit inside it instead of copying the shell radius language."
            />
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
