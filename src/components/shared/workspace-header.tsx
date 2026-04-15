import { ArrowLeft, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

type WorkspaceHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  backLabel?: string;
  onBack?: () => void;
  closeLabel: string;
  onClose: () => void;
  actions?: ReactNode;
};

export const workspaceHeaderActionClassName =
  "h-10 rounded-full border border-border/70 bg-background/70 px-3 font-sans text-[0.88rem] font-normal hover:bg-card/80";

export function WorkspaceHeader({
  eyebrow,
  title,
  subtitle,
  backLabel,
  onBack,
  closeLabel,
  onClose,
  actions = null,
}: WorkspaceHeaderProps) {
  return (
    <div className="border-b border-border/70 bg-background/88 px-6 py-5 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {backLabel && onBack ? (
            <div className="mb-4">
              <Button variant="ghost" className={workspaceHeaderActionClassName} onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
                {backLabel}
              </Button>
            </div>
          ) : null}
          <p className="font-sans text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
          <h1 className="mt-2 font-sans text-2xl font-normal tracking-[-0.03em] text-foreground">{title}</h1>
          <p className="mt-1 font-serif text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <Button
            variant="ghost"
            className={`${workspaceHeaderActionClassName} w-10 justify-center px-0`}
            aria-label={closeLabel}
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
