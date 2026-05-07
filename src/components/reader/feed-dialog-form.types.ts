import type { RefObject } from "react";
import type { CopyableReadonlyFieldItem } from "@/components/shared/copyable-field.types";
import type { DiscoveredFeedOption } from "./add-feed-dialog.types";

export type FeedDialogUrlSectionProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  onDiscover: () => void;
  discoverLabel: string;
  discoveringLabel: string;
  discovering: boolean;
  disabled: boolean;
  discoverDisabled: boolean;
  placeholder: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  discoveredFeedsFoundLabel: string | null;
  discoveredFeedOptions: DiscoveredFeedOption[];
  selectedFeedUrl: string;
  onSelectedFeedUrlChange: (value: string) => void;
  helperText?: string | null;
  helperTone?: "muted" | "error";
};

export type FeedDialogUrlSectionViewProps = FeedDialogUrlSectionProps & {
  inputId: string;
  helperTextId: string;
};

export type FeedDialogReadonlyFieldProps = CopyableReadonlyFieldItem;

export type FeedDialogSelectOption = {
  value: string;
  label: string;
};
