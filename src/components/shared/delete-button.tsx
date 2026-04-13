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
        "border-destructive/25 bg-destructive/10 font-medium text-destructive shadow-none hover:bg-destructive/18 hover:text-destructive focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:border-destructive/35 dark:bg-destructive/20 dark:hover:bg-destructive/30",
        className,
      )}
      {...props}
    >
      {showIcon ? <Trash2 className="size-3.5" /> : null}
      {children}
    </Button>
  );
}
