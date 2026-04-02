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
        className="pointer-events-auto size-11 rounded-full border border-white/10 bg-black/78 text-white shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-md hover:bg-black/90"
      >
        <X className="h-5 w-5" />
      </IconToolbarButton>
    </div>
  );
}
