import { Command, CommandInput, CommandSeparator } from "../ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { CommandPaletteResults } from "./command-palette-results";
import { useCommandPaletteController } from "./use-command-palette-controller";

function getCommandItemValue(kind: "action" | "feed" | "tag" | "article" | "scenario", id: string): string {
  return `${kind}:${id}`;
}

export function CommandPalette() {
  const { open, input, setInput, closePalette, title, description, placeholder, resultsProps, prefixHints } =
    useCommandPaletteController();

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closePalette();
        }
      }}
    >
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className="overflow-hidden rounded-2xl border border-border/70 bg-surface-2/96 p-0 shadow-elevation-3"
        overlayPreset="readable"
        showCloseButton={false}
      >
        <Command
          shouldFilter={false}
          className="[&_[cmdk-group-heading]]:text-foreground-soft **:data-[slot=command-input-wrapper]:h-14 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-3 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-1 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
        >
          <CommandInput placeholder={placeholder} value={input} onValueChange={setInput} />
          <CommandPaletteResults getCommandItemValue={getCommandItemValue} {...resultsProps} />
          <CommandSeparator />
          <div
            data-testid="command-palette-prefix-hints"
            className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs text-foreground-soft sm:gap-4"
          >
            <div
              data-testid="command-palette-prefix-hint-actions"
              className="flex items-center gap-1 rounded-md bg-surface-1/72 px-2 py-1"
            >
              <span className="font-mono">&gt;</span>
              <span>{prefixHints.actions}</span>
            </div>
            <div
              data-testid="command-palette-prefix-hint-feeds"
              className="flex items-center gap-1 rounded-md bg-surface-1/72 px-2 py-1"
            >
              <span className="font-mono">@</span>
              <span>{prefixHints.feeds}</span>
            </div>
            <div
              data-testid="command-palette-prefix-hint-tags"
              className="flex items-center gap-1 rounded-md bg-surface-1/72 px-2 py-1"
            >
              <span className="font-mono">#</span>
              <span>{prefixHints.tags}</span>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
