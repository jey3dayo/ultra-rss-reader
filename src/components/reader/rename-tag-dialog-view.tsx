import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FormActionButtons } from "@/components/shared/form-action-buttons";
import { StackedInputField } from "@/components/shared/stacked-input-field";
import { TagColorPicker } from "@/components/shared/tag-color-picker";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const EMPTY_COLOR_OPTIONS: string[] = [];
const NO_OP_COLOR_CHANGE = () => {};

export type RenameTagDialogViewProps = {
  open: boolean;
  name: string;
  color?: string | null;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onNameChange: (value: string) => void;
  onColorChange?: (value: string | null) => void;
  colorOptions?: string[];
  noColorLabel?: string;
  onSubmit: () => void;
};

export function RenameTagDialogView({
  open,
  name,
  color = null,
  loading,
  onOpenChange,
  onNameChange,
  onColorChange = NO_OP_COLOR_CHANGE,
  colorOptions = EMPTY_COLOR_OPTIONS,
  noColorLabel,
  onSubmit,
}: RenameTagDialogViewProps) {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("edit_tag")}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className="space-y-4"
        >
          <StackedInputField
            label={t("name")}
            inputRef={inputRef}
            name="tag-name"
            type="text"
            value={name}
            onChange={onNameChange}
            inputClassName="mt-1"
            disabled={loading}
          />
          {colorOptions.length > 0 && (
            <TagColorPicker
              label={t("color")}
              color={color}
              colorOptions={colorOptions}
              noColorLabel={noColorLabel ?? t("no_color")}
              optionAriaLabel={(option) => `${t("color")} ${option}`}
              onChange={onColorChange}
            />
          )}
        </form>
        <DialogFooter>
          <FormActionButtons
            cancelLabel={tc("cancel")}
            submitLabel={tc("save")}
            submittingLabel={tc("saving")}
            loading={loading}
            submitDisabled={!name.trim() || loading}
            cancelDisabled={loading}
            onCancel={() => onOpenChange(false)}
            onSubmit={onSubmit}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
