import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
  AnnotatedNote,
  DisabledSwitchSpecimen,
  FormRowsSpecimen,
  ReferencePage,
  ValidationRowSpecimen,
} from "@/components/storybook/ui-reference-canvas-specimens";

export function SettingsSectionsCanvas() {
  const [livePreview, setLivePreview] = useState(true);

  return (
    <ReferencePage maxWidthClassName="max-w-4xl">
      <div className="space-y-4">
        <AnnotatedNote
          title="Settings sections"
          body="Form rows, validation states, and disabled controls live here. Shell examples stay in Shell & Overlay Canvas."
        />
        <FormRowsSpecimen livePreview={livePreview} onLivePreviewChange={setLivePreview} />
        <ValidationRowSpecimen />
        <DisabledSwitchSpecimen />
      </div>
    </ReferencePage>
  );
}

const meta = {
  title: "UI Reference/Settings Sections Canvas",
  component: SettingsSectionsCanvas,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof SettingsSectionsCanvas>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
