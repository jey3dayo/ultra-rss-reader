import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "@/components/ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LabeledControlRow } from "./labeled-control-row";

const meta = {
  title: "Shared/LabeledControlRow",
  component: LabeledControlRow,
  parameters: {
    layout: "padded",
  },
  args: {
    label: "Server URL",
  },
} satisfies Meta<typeof LabeledControlRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithInput: Story = {
  render: (args) => (
    <div className="max-w-xl">
      <LabeledControlRow {...args} htmlFor="storybook-row-input">
        <Input
          id="storybook-row-input"
          value="https://example.com/rss"
          readOnly
          className="h-auto w-auto border-border bg-background px-2 py-1 text-sm"
        />
      </LabeledControlRow>
    </div>
  ),
};

export const WithSelect: Story = {
  args: {
    label: "Account type",
  },
  render: (args) => (
    <div className="max-w-xl">
      <LabeledControlRow {...args} labelId="storybook-row-label">
        <Select name="account-type" value="freshrss" disabled>
          <SelectTrigger aria-labelledby="storybook-row-label">
            <SelectValue>{() => "FreshRSS"}</SelectValue>
          </SelectTrigger>
          <SelectPopup>
            <SelectItem value="freshrss">FreshRSS</SelectItem>
          </SelectPopup>
        </Select>
      </LabeledControlRow>
    </div>
  ),
};
