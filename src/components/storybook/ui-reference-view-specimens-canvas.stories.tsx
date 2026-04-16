import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  AccountCardStackSpecimen,
  AnnotatedNote,
  AnnouncementCardsSpecimen,
  NavigationStackSpecimen,
  ReaderFilterStripSpecimen,
  ReferencePage,
  SurfaceRoleSpecimen,
  TagPaletteSpecimen,
  WorkspaceFilterClusterSpecimen,
} from "@/components/storybook/ui-reference-canvas-specimens";

export function ViewSpecimensCanvas() {
  return (
    <ReferencePage maxWidthClassName="max-w-5xl">
      <div className="space-y-4">
        <AnnotatedNote
          title="View specimens"
          body="Feature-local presentation examples live here. Use this canvas for density, stacking, and representative display fragments after checking shared controls and shell framing."
        />
        <SurfaceRoleSpecimen />
        <div className="grid gap-4 xl:grid-cols-2">
          <ReaderFilterStripSpecimen />
          <WorkspaceFilterClusterSpecimen />
          <AccountCardStackSpecimen />
          <NavigationStackSpecimen />
          <AnnouncementCardsSpecimen />
          <TagPaletteSpecimen />
        </div>
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
