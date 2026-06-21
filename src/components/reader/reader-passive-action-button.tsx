import type { ComponentPropsWithoutRef } from "react";
import { Button } from "@/design-system";

type ReaderPassiveActionButtonProps = ComponentPropsWithoutRef<typeof Button>;

export function ReaderPassiveActionButton({ type = "button", ...props }: ReaderPassiveActionButtonProps) {
  return <Button type={type} {...props} data-reader-passive-action="true" />;
}
