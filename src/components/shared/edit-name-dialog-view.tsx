import type { ComponentProps, ReactNode } from "react";
import { useEffect, useId, useRef } from "react";
import { cancelAnimationFrameHandle, scheduleAnimationFrame } from "@/lib/dom/animation-frame";
import { focusAndSelectInput } from "@/lib/dom/input-focus";
import { FormDialogShell } from "./form-dialog-shell";
import { StackedInputField } from "./stacked-input-field";
import { SurfaceCard } from "./surface-card";

type EditNameDialogViewProps = {
  open: boolean;
  modal?: boolean;
  portalContainer?: ComponentProps<typeof FormDialogShell>["portalContainer"];
  title: string;
  nameLabel: string;
  inputName: string;
  name: string;
  loading: boolean;
  cancelLabel: string;
  submitLabel: string;
  submittingLabel: string;
  submitDisabled?: boolean;
  cancelDisabled?: boolean;
  errorMessage?: string | null;
  children?: ReactNode;
  onOpenChange: (open: boolean) => void;
  onNameChange: (value: string) => void;
  onSubmit: () => void;
};

export function EditNameDialogView({
  open,
  modal = true,
  portalContainer,
  title,
  nameLabel,
  inputName,
  name,
  loading,
  cancelLabel,
  submitLabel,
  submittingLabel,
  submitDisabled = false,
  cancelDisabled = loading,
  errorMessage,
  children,
  onOpenChange,
  onNameChange,
  onSubmit,
}: EditNameDialogViewProps) {
  const inputRef = useDialogAutofocus(open);
  const errorId = useId();

  return (
    <FormDialogShell
      open={open}
      modal={modal}
      portalContainer={portalContainer}
      title={title}
      cancelLabel={cancelLabel}
      submitLabel={submitLabel}
      submittingLabel={submittingLabel}
      loading={loading}
      submitDisabled={!name.trim() || submitDisabled}
      cancelDisabled={cancelDisabled}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
    >
      <StackedInputField
        label={nameLabel}
        inputRef={inputRef}
        name={inputName}
        type="text"
        value={name}
        onChange={onNameChange}
        inputClassName="mt-1"
        disabled={loading}
        ariaInvalid={Boolean(errorMessage)}
        ariaDescribedBy={errorMessage ? errorId : undefined}
      />
      {children}
      {errorMessage ? (
        <SurfaceCard variant="info" tone="danger" padding="compact" role="alert" id={errorId}>
          <p className="text-sm leading-[1.5]">{errorMessage}</p>
        </SurfaceCard>
      ) : null}
    </FormDialogShell>
  );
}

export function useDialogAutofocus(open: boolean) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingFocusFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = scheduleAnimationFrame(() => {
      if (pendingFocusFrameRef.current !== frame) {
        return;
      }

      pendingFocusFrameRef.current = null;
      focusAndSelectInput(inputRef.current);
    });
    pendingFocusFrameRef.current = frame;

    return () => {
      if (frame !== null && pendingFocusFrameRef.current === frame) {
        pendingFocusFrameRef.current = null;
        cancelAnimationFrameHandle(frame);
      }
    };
  }, [open]);

  return inputRef;
}
