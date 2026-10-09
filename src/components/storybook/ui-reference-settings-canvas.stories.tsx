import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import {
  AnnotatedNote,
  DisabledSwitchSpecimen,
  FormRowsSpecimen,
  LabelHelpSwitchSpecimen,
  PrimitiveControlMatrixSpecimen,
  ReferencePage,
  ValidationRowSpecimen,
} from "@/components/storybook/ui-reference-settings-specimens";

export function InputControlsCanvas() {
  const [livePreview, setLivePreview] = useState(true);

  return (
    <ReferencePage maxWidthClassName="max-w-4xl">
      <div className="space-y-4">
        <AnnotatedNote
          title="Input controls"
          body="Form rows, validation states, and disabled controls live here. Shell examples stay in Shell & Overlay Canvas."
        />
        <FormRowsSpecimen livePreview={livePreview} onLivePreviewChange={setLivePreview} />
        <LabelHelpSwitchSpecimen />
        <PrimitiveControlMatrixSpecimen />
        <ValidationRowSpecimen />
        <DisabledSwitchSpecimen />
      </div>
    </ReferencePage>
  );
}

const meta = {
  title: "UI Reference/Input Controls Canvas",
  component: InputControlsCanvas,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof InputControlsCanvas>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "About app passwords" }));
    await expect(within(document.body).getByRole("dialog", { name: "App password details" })).toBeVisible();
  },
};
