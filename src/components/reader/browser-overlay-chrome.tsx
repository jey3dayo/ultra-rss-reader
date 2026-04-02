import { X } from "lucide-react";
import { IconToolbarButton } from "@/components/shared/icon-toolbar-control";
import { cn } from "@/lib/utils";

type BrowserOverlayChromeProps = {
  closeLabel: string;
  onClose: () => void;
  className?: string;
};

export function BrowserOverlayChrome({ closeLabel, onClose, className }: BrowserOverlayChromeProps) {
  return (
    <div data-testid="browser-overlay-chrome" className={cn("pointer-events-none absolute z-10", className)}>
      <IconToolbarButton
        label={closeLabel}
        onClick={onClose}
        className="pointer-events-auto rounded-full border border-border/60 bg-background/85 text-foreground shadow-sm backdrop-blur-sm hover:bg-background/95"
      >
        <X className="h-4 w-4" />
      </IconToolbarButton>
    </div>
  );
}
