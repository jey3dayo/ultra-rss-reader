import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  AnnotatedNote,
  AnnouncementCardsSpecimen,
  DetailPanelSpecimen,
  ReferencePage,
  WorkspaceActionClusterSpecimen,
  WorkspaceFilterClusterSpecimen,
  WorkspaceTwoPaneSpecimen,
} from "@/components/storybook/ui-reference-canvas-specimens";

export function WorkspacePatternsCanvas() {
  return (
    <ReferencePage maxWidthClassName="max-w-6xl">
      <div className="space-y-4">
        <AnnotatedNote
          title="Workspace patterns"
          body="Dense workspace filters, action clusters, detail panels, and two-pane compositions live here."
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <WorkspaceFilterClusterSpecimen />
          <WorkspaceActionClusterSpecimen />
          <AnnouncementCardsSpecimen />
          <DetailPanelSpecimen />
        </div>
        <WorkspaceTwoPaneSpecimen />
      </div>
    </ReferencePage>
  );
}

const meta = {
  title: "UI Reference/Workspace Patterns Canvas",
  component: WorkspacePatternsCanvas,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof WorkspacePatternsCanvas>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
