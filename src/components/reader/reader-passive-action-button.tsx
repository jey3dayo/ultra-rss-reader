import type { ComponentPropsWithoutRef } from "react";
import { Button } from "@/components/ui/button";

type ReaderPassiveActionButtonProps = ComponentPropsWithoutRef<typeof Button>;

export function ReaderPassiveActionButton({ type = "button", ...props }: ReaderPassiveActionButtonProps) {
  return <Button type={type} {...props} data-reader-passive-action="true" />;
}
