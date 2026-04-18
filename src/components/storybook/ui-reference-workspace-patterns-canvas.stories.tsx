import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  AnnotatedNote,
  AnnouncementCardsSpecimen,
  DetailPanelSpecimen,
  ReferencePage,
  SettingsHeaderSummarySpecimen,
  WorkspaceActionClusterSpecimen,
  WorkspaceFilterClusterSpecimen,
  WorkspaceTwoPaneSpecimen,
} from "@/components/storybook/ui-reference-canvas-specimens";

export function ViewSpecimensCanvas() {
  return (
    <ReferencePage maxWidthClassName="max-w-6xl">
      <div className="space-y-4">
        <AnnotatedNote
          title="View specimens"
          body="Feature-local display fragments, dense workspace patterns, and two-pane specimens live here."
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <WorkspaceFilterClusterSpecimen />
          <WorkspaceActionClusterSpecimen />
          <AnnouncementCardsSpecimen />
          <DetailPanelSpecimen />
        </div>
        <SettingsHeaderSummarySpecimen />
        <WorkspaceTwoPaneSpecimen />
      </div>
    </ReferencePage>
  );
}

const meta = {
  title: "UI Reference/View Specimens Canvas",
  component: ViewSpecimensCanvas,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ViewSpecimensCanvas>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
