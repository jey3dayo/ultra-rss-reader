import { Trash2 } from "lucide-react";
import type { ComponentProps } from "react";
import { stateSurfaceButtonClassName } from "@/components/shared/state-surface-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DeleteButtonProps = ComponentProps<typeof Button> & {
  showIcon?: boolean;
};

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
      className={cn(stateSurfaceButtonClassName("danger"), "font-medium focus-visible:ring-destructive/20", className)}
      {...props}
    >
      {showIcon ? <Trash2 className="size-3.5" /> : null}
      {children}
    </Button>
  );
}
