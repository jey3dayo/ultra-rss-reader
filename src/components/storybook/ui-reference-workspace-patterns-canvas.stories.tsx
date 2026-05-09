import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  AnnotatedNote,
  AnnouncementCardsSpecimen,
  DetailPanelSpecimen,
  MotionNumberSpecimen,
  ReferencePage,
  SubscriptionGroupDisclosureSpecimen,
  SummaryFilterCardsSpecimen,
  WorkspaceActionClusterSpecimen,
  WorkspaceFilterClusterSpecimen,
  WorkspaceTwoPaneSpecimen,
} from "@/components/storybook/ui-reference-workspace-specimens";

export function ViewSpecimensCanvas() {
  return (
    <ReferencePage maxWidthClassName="max-w-6xl">
      <div className="space-y-4">
        <AnnotatedNote
          title="View specimens"
          body="Feature-local display fragments, dense workspace patterns, and two-pane specimens live here."
        />
        <SummaryFilterCardsSpecimen />
        <div className="grid items-start gap-4 xl:grid-cols-2">
          <WorkspaceFilterClusterSpecimen />
          <MotionNumberSpecimen />
          <SubscriptionGroupDisclosureSpecimen />
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
  title: "UI Reference/View Specimens Canvas",
  component: ViewSpecimensCanvas,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ViewSpecimensCanvas>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
