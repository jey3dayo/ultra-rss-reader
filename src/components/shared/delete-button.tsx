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
        "border-destructive/30 bg-destructive/10 font-medium text-destructive shadow-none hover:border-destructive/40 hover:bg-destructive/15 hover:text-destructive focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        className,
      )}
      {...props}
    >
      {showIcon ? <Trash2 className="size-3.5" /> : null}
      {children}
    </Button>
  );
}
