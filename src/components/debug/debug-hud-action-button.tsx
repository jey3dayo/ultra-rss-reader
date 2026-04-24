import type { ComponentProps } from "react";
import { SettingsActionButton } from "@/components/settings/settings-action-button";
import { cn } from "@/lib/utils";

type DebugHudActionButtonProps = Omit<ComponentProps<typeof SettingsActionButton>, "size" | "tone">;

export function DebugHudActionButton({ className, ...props }: DebugHudActionButtonProps) {
  return (
    <SettingsActionButton
      data-debug-hud-action-button=""
      size="compact"
      tone="subtle"
      className={cn(
        "border-transparent bg-transparent text-white/56 shadow-none",
        "hover:border-transparent hover:bg-white/[0.04] hover:text-white/82",
        "focus-visible:border-transparent focus-visible:bg-white/[0.04] focus-visible:text-white/82 focus-visible:ring-white/16",
        className,
      )}
      {...props}
    />
  );
}
