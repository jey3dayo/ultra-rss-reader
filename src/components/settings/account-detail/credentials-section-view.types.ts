import type { RefObject } from "react";
import type { CloudflareAccessDraftError } from "@/lib/account/cloudflare-access";

export type AccountCredentialInputRow = {
  label: string;
  value: string;
  placeholder?: string;
  type?: "text" | "password" | "url";
  onChange: (value: string) => void;
  onBlur: () => void;
  onFocus?: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  errorText?: string;
};

export type AccountCloudflareAccessSection = {
  status: "loading" | "ready" | "error" | "unavailable";
  recoveryAction?: "replace" | "remove" | null;
  onRecoveryActionChange?: (action: "replace" | "remove") => void;
  loadingMessage: string;
  readErrorMessage: string;
  unavailableMessage: string;
  label: string;
  description: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  clientId: AccountCredentialInputRow;
  clientSecret: AccountCredentialInputRow;
  clientIdError: string;
  clientSecretError: string;
  validationError: CloudflareAccessDraftError | null;
};
