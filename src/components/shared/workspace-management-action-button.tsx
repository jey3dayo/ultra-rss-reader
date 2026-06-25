import type { ComponentProps, ReactNode } from "react";
import { workspaceCompactActionButtonClassName } from "@/components/shared/decision-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WorkspaceManagementActionButtonProps = Omit<ComponentProps<typeof Button>, "children" | "variant" | "size"> & {
  intent: "edit" | "delete";
  label: string;
  children: ReactNode;
};

const workspaceManagementActionIntentClassName: Record<WorkspaceManagementActionButtonProps["intent"], string> = {
  edit: "bg-surface-1/88 text-foreground-soft hover:bg-surface-2 hover:text-foreground",
  delete: "bg-state-danger-surface text-state-danger-foreground hover:bg-state-danger-surface",
};

export function WorkspaceManagementActionButton({
  intent,
  label,
  className,
  type = "button",
  ...props
}: WorkspaceManagementActionButtonProps) {
  return (
    <Button
      {...props}
      type={type}
      variant="ghost"
      size="sm"
      aria-label={label}
      className={cn(workspaceCompactActionButtonClassName, workspaceManagementActionIntentClassName[intent], className)}
    />
  );
}
