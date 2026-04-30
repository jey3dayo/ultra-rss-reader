import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  AnnotatedNote,
  ArticleFilterToggleButtonSpecimen,
  ButtonFamilyGuideSpecimen,
  ButtonSizeMatrixSpecimen,
  ButtonVariantMatrixSpecimen,
  IconUtilityButtonSpecimen,
  LoadingAndFormActionsSpecimen,
  ReaderHeaderActionStripSpecimen,
  ReferencePage,
  SemanticActionButtonsSpecimen,
  SettingsActionButtonSpecimen,
  SpecializedButtonPatternsSpecimen,
} from "@/components/storybook/ui-reference-canvas-specimens";

export function ButtonControlsCanvas() {
  return (
    <ReferencePage>
      <div className="space-y-6">
        <AnnotatedNote
          title="Button controls"
          body="Use this canvas to choose the right action family before adding raw button markup or feature-local button classes."
        />
        <ButtonFamilyGuideSpecimen />
        <ButtonVariantMatrixSpecimen />
        <ButtonSizeMatrixSpecimen />
        <SettingsActionButtonSpecimen />
        <LoadingAndFormActionsSpecimen />
        <SemanticActionButtonsSpecimen />
        <ArticleFilterToggleButtonSpecimen />
        <ReaderHeaderActionStripSpecimen />
        <IconUtilityButtonSpecimen />
        <SpecializedButtonPatternsSpecimen />
      </div>
    </ReferencePage>
  );
}

const meta = {
  title: "UI Reference/Button Controls Canvas",
  component: ButtonControlsCanvas,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ButtonControlsCanvas>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
