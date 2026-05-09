import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  AnnotatedNote,
  CommandPaletteShellSpecimen,
  LeftBandShellSpecimen,
  MainContentShellSpecimen,
  MotionTransitionsSpecimen,
  ReferencePage,
  ShellExamplesSpecimen,
  UpdateToastStabilitySpecimen,
} from "@/components/storybook/ui-reference-shell-specimens";

export function ShellOverlayCanvas() {
  return (
    <ReferencePage>
      <div className="space-y-6">
        <AnnotatedNote
          title="Shell & overlay"
          body="Outer frame patterns belong here. Use this canvas for rails, main content shells, dialogs, context menu framing, and borderless utility-action chrome, not for generic section cards."
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
        <MotionTransitionsSpecimen />
        <UpdateToastStabilitySpecimen />
        <CommandPaletteShellSpecimen />
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
