import type { Meta, StoryObj } from "@storybook/react-vite";
import { Copy, RefreshCw, Settings2, Star } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./command";

type CommandStoryProps = {
  query: string;
  testId: string;
};

function CommandStory({ query, testId }: CommandStoryProps) {
  return (
    <div className="w-full max-w-[420px] rounded-lg border border-border bg-popover text-popover-foreground shadow-elevation-2">
      <Command data-testid={testId}>
        <CommandInput
          aria-label="Search commands"
          placeholder="Search reader actions..."
          value={query}
          onValueChange={() => {}}
        />
        <CommandList>
          <CommandEmpty>No commands found.</CommandEmpty>
          <CommandGroup heading="Reader">
            <CommandItem value="sync all feeds">
              <RefreshCw className="size-4" />
              Sync all feeds
              <CommandShortcut>Cmd R</CommandShortcut>
            </CommandItem>
            <CommandItem value="star current article">
              <Star className="size-4" />
              Star current article
              <CommandShortcut>S</CommandShortcut>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem value="open settings">
              <Settings2 className="size-4" />
              Open settings
              <CommandShortcut>Cmd ,</CommandShortcut>
            </CommandItem>
            <CommandItem value="copy article link">
              <Copy className="size-4" />
              Copy article link
              <CommandShortcut>Shift Cmd C</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}

const meta = {
  title: "Primitives/Command",
  component: CommandStory,
  tags: ["autodocs"],
  args: {
    query: "",
    testId: "command-results-smoke",
  },
  decorators: [
    (Story) => (
      <div className="min-h-[280px] bg-background p-4 text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CommandStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Results: Story = {};

export const Empty: Story = {
  args: {
    query: "zz-no-command",
    testId: "command-empty-smoke",
  },
};
