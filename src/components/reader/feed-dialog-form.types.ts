import type { RefObject } from "react";
import type { CopyableReadonlyFieldItem } from "@/components/shared/copyable-field.types";
import type { DiscoveredFeedOption } from "./discovered-feed-options-view";
import type { FolderSelectViewProps } from "./folder-select-view";

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

export type FeedDialogFormUrlSectionProps = Omit<FeedDialogUrlSectionViewProps, "helperTextId" | "inputId">;

export type FeedDialogFormLabels = {
  title: string;
  description?: string;
  cancel: string;
  submit: string;
  submitting: string;
};

export type FeedDialogTextSectionProps = {
  label: string;
  name: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
};

export type FeedDialogReadonlyFieldProps = CopyableReadonlyFieldItem;

export type FeedDialogSelectOption = {
  value: string;
  label: string;
};

export type FeedDialogSelectSectionProps = {
  label: string;
  name: string;
  value: string;
  options: FeedDialogSelectOption[];
  disabled: boolean;
  onValueChange: (value: string) => void;
};

export type FeedDialogFormViewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  isSubmitDisabled: boolean;
  labels: FeedDialogFormLabels;
  urlSection?: FeedDialogFormUrlSectionProps;
  textSection?: FeedDialogTextSectionProps;
  readonlyFields?: FeedDialogReadonlyFieldProps[];
  selectSection?: FeedDialogSelectSectionProps;
  folderSelectProps?: FolderSelectViewProps;
  error?: string | null;
  successMessage?: string | null;
  onSubmit: () => void;
};
