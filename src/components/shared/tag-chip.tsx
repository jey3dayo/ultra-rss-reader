import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type TagChipProps = {
  label: string;
  color?: string | null;
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
};

export function TagChip({ label, color, onRemove, removeLabel, className }: TagChipProps) {
  return (
    <span
      className={cn(
        "group/tag-chip inline-flex min-h-6 items-center gap-1 rounded-full border border-border/38 bg-transparent px-2.5 pr-1.5 text-[12px] leading-none text-foreground/86 transition-[border-color,background-color,color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-border/54 hover:bg-background/14 focus-within:border-border/54 motion-reduce:transition-none",
        className,
      )}
    >
      {color ? <span className="inline-block size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} /> : null}
      <span className="truncate">{label}</span>
      {onRemove && removeLabel ? (
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex size-4 items-center justify-center rounded-full text-foreground-soft opacity-55 transition-[opacity,color,background-color,box-shadow] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/tag-chip:opacity-100 group-focus-within/tag-chip:opacity-100 hover:bg-surface-1/72 hover:text-foreground hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:opacity-100 motion-reduce:transition-none"
          aria-label={removeLabel}
        >
          <X className="size-3" aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}
