import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  AccountCardStackSpecimen,
  AnnotatedNote,
  NavigationStackSpecimen,
  ReaderFilterStripSpecimen,
  ReferencePage,
  TagPaletteSpecimen,
} from "@/components/storybook/ui-reference-canvas-specimens";

export function NavigationCollectionsCanvas() {
  return (
    <ReferencePage maxWidthClassName="max-w-5xl">
      <div className="space-y-4">
        <AnnotatedNote
          title="Navigation & collections"
          body="Reader filters, account stacks, nav rows, folder stacks, and tag palette patterns live here."
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <ReaderFilterStripSpecimen />
          <AccountCardStackSpecimen />
          <NavigationStackSpecimen />
          <TagPaletteSpecimen />
        </div>
      </div>
    </ReferencePage>
  );
}

const meta = {
  title: "UI Reference/Navigation & Collections Canvas",
  component: NavigationCollectionsCanvas,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof NavigationCollectionsCanvas>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
