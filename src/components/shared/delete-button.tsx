import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DeleteButtonProps } from "./button.types";

export function DeleteButton({
  className,
  children,
  showIcon = true,
  variant = "outline",
  ...props
}: DeleteButtonProps) {
  return (
    <Button
      data-delete-button
      variant={variant}
      className={cn(
        "border-state-danger-border bg-state-danger-surface font-medium text-state-danger-foreground shadow-none hover:border-state-danger-border hover:bg-state-danger-surface hover:text-state-danger-foreground focus-visible:border-state-danger-border focus-visible:ring-destructive/20",
        className,
      )}
      {...props}
    >
      {showIcon ? <Trash2 className="size-3.5" /> : null}
      {children}
    </Button>
  );
}
