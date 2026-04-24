import type { ComponentProps } from "react";
import { SettingsActionButton } from "@/components/settings/settings-action-button";
import { cn } from "@/lib/utils";

type DebugHudActionButtonProps = Omit<ComponentProps<typeof SettingsActionButton>, "size" | "tone">;

export function DebugHudActionButton({ className, ...props }: DebugHudActionButtonProps) {
  return (
    <SettingsActionButton
      size="compact"
      tone="subtle"
      className={cn(
        "min-w-11 justify-center gap-1.5 border border-white/10 bg-white/[0.04] text-white/84 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        "hover:border-white/16 hover:bg-white/[0.08] hover:text-white",
        "focus-visible:border-white/16 focus-visible:bg-white/[0.08] focus-visible:text-white focus-visible:ring-white/24",
        className,
      )}
      {...props}
    />
  );
}
