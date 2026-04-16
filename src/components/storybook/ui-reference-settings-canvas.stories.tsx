import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
  AnnotatedNote,
  DisabledSwitchSpecimen,
  FormRowsSpecimen,
  ReferencePage,
  ValidationRowSpecimen,
} from "@/components/storybook/ui-reference-canvas-specimens";

export function InputControlsCanvas() {
  const [livePreview, setLivePreview] = useState(true);

  return (
    <ReferencePage maxWidthClassName="max-w-4xl">
      <div className="space-y-4">
        <AnnotatedNote
          title="Input controls"
          body="Form rows, validation states, and disabled controls live here. Check this canvas before inventing a new form treatment."
        />
        <FormRowsSpecimen livePreview={livePreview} onLivePreviewChange={setLivePreview} />
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

export const Default: Story = {};
