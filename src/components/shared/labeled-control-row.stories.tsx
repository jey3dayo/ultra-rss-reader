import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import {
  Input,
  LabeledControlRow,
  LabeledSwitchRow,
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
  SettingsInfoPopover,
} from "@/design-system";

const meta = {
  title: "Shared/Rows/LabeledControlRow",
  component: LabeledControlRow,
  tags: ["autodocs"],
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

export const WithLongLabel: Story = {
  args: {
    label: "Open links in the background when using the article actions toolbar",
  },
  render: (args) => (
    <div className="max-w-xl">
      <LabeledControlRow {...args}>
        <Input value="Enabled" readOnly className="h-auto w-auto border-border bg-background px-2 py-1 text-sm" />
      </LabeledControlRow>
    </div>
  ),
};

export const WithLabelHelp: Story = {
  args: {
    label: "Use an app password",
    description: "Adds account-specific access for this server.",
  },
  render: (args) => (
    <div className="max-w-xl">
      <LabeledControlRow
        {...args}
        htmlFor="storybook-row-help-input"
        labelAccessory={
          <SettingsInfoPopover
            title="App password details"
            ariaLabel="About app passwords"
            content="Create an app-specific password on the server and store it with this account."
          />
        }
      >
        <Input
          id="storybook-row-help-input"
          value="Enabled"
          readOnly
          className="h-auto w-auto border-border bg-background px-2 py-1 text-sm"
        />
      </LabeledControlRow>
    </div>
  ),
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "About app passwords" }));
    await expect(within(document.body).getByRole("dialog", { name: "App password details" })).toBeVisible();
  },
};

export const NarrowLongLabelHelp: Story = {
  render: () => (
    <div className="w-[18rem]">
      <LabeledSwitchRow
        label="Keep the currently selected article visible when switching between feeds"
        description="This preference applies to the current reading session."
        checked={false}
        onChange={() => {}}
        labelAccessory={
          <SettingsInfoPopover
            title="Article selection"
            ariaLabel="About article selection"
            content="When this is enabled, switching feeds keeps the selected article in view when it is still available."
          />
        }
      />
    </div>
  ),
};
