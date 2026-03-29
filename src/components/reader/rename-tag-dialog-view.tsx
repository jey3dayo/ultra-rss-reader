import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function RenameTagDialogView({
  open,
  name,
  loading,
  error,
  onOpenChange,
  onNameChange,
  onSubmit,
}: {
  open: boolean;
  name: string;
  loading: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onNameChange: (value: string) => void;
  onSubmit: () => void;
}) {
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
          <DialogTitle>{t("rename_tag")}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className="space-y-4"
        >
          <label className="block text-sm text-muted-foreground">
            {t("name")}
            <Input
              ref={inputRef}
              name="tag-name"
              type="text"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              className="mt-1"
              disabled={loading}
            />
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {tc("cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={!name.trim() || loading}>
            {loading ? tc("saving") : tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
