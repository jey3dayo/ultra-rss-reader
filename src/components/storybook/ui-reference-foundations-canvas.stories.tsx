import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  AnnotatedNote,
  ReferencePage,
  SemanticStateSurfaceSpecimen,
  SurfaceRoleSpecimen,
  TypographyScaleSpecimen,
} from "@/components/storybook/ui-reference-canvas-specimens";

export function FoundationsCanvas() {
  return (
    <ReferencePage maxWidthClassName="max-w-5xl">
      <div className="space-y-4">
        <AnnotatedNote
          title="Foundations"
          body="Typography, semantic surfaces, and tone roles live here. Check this canvas before inventing new hierarchy or state treatment."
        />
        <TypographyScaleSpecimen />
        <SemanticStateSurfaceSpecimen />
        <SurfaceRoleSpecimen />
      </div>
    </ReferencePage>
  );
}

const meta = {
  title: "UI Reference/Foundations Canvas",
  component: FoundationsCanvas,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof FoundationsCanvas>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
