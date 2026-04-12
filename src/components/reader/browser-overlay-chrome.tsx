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
    <div data-testid="browser-overlay-chrome" className={cn("pointer-events-none absolute z-[60]", className)}>
      <IconToolbarButton
        label={closeLabel}
        onClick={onClose}
        className="pointer-events-auto size-[46px] rounded-[12px] border border-transparent bg-transparent text-white/86 shadow-none backdrop-blur-0 transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-white/14 hover:bg-white/10 hover:text-white hover:shadow-[0_12px_28px_rgba(0,0,0,0.28)] focus-visible:border-white/18 focus-visible:bg-white/11 focus-visible:text-white focus-visible:ring-2 focus-visible:ring-white/18 focus-visible:ring-offset-0 active:scale-[0.97] active:border-white/18 active:bg-white/16 active:shadow-[0_8px_18px_rgba(0,0,0,0.22)]"
      >
        <X className="h-4 w-4" />
      </IconToolbarButton>
    </div>
  );
}
