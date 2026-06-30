import { XIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { MOTION_CONTENT_SWAP_CLASS_NAME } from "@/constants/motion";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Kbd,
} from "@/design-system";
import { useStableOpenTranslation } from "@/lib/i18n/use-stable-open-translation";
import { getShortcutDisplay, type ShortcutDefinition, shortcutDefinitions } from "@/lib/keyboard/keyboard-shortcuts";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";

const CATEGORY_ORDER: ShortcutDefinition["categoryKey"][] = [
  "shortcuts.category_navigation",
  "shortcuts.category_actions",
  "shortcuts.category_global",
];

type ShortcutsHelpModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ShortcutHelpItem = {
  definition: ShortcutDefinition;
  label: string;
  displayKey: string;
  searchValue: string;
};

export function ShortcutsHelpModal({ open, onOpenChange }: ShortcutsHelpModalProps) {
  const t = useStableOpenTranslation("reader", open);
  const { t: tCommon } = useTranslation("common");
  const platformKind = usePlatformStore((state) => state.platform.kind);
  const shortcutPrefs = usePreferencesStore((state) => state.prefs);
  const [searchValue, setSearchValue] = useState("");

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setSearchValue("");
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  const shortcuts = useMemo<ShortcutHelpItem[]>(
    () =>
      shortcutDefinitions.map((definition) => {
        const label = t(definition.labelKey);
        const displayKey = getShortcutDisplay(definition.id, shortcutPrefs, platformKind);
        const category = t(definition.categoryKey);

        return {
          definition,
          label,
          displayKey,
          searchValue: `${label} ${displayKey} ${category}`.toLowerCase(),
        };
      }),
    [platformKind, shortcutPrefs, t],
  );

  const shortcutsByCategory = useMemo(() => {
    return CATEGORY_ORDER.map((categoryKey) => ({
      categoryKey,
      heading: t(categoryKey),
      items: shortcuts.filter((shortcut) => shortcut.definition.categoryKey === categoryKey),
    }));
  }, [shortcuts, t]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-2xl" showCloseButton={false}>
        <div className="border-b p-4">
          <DialogHeader className="relative space-y-2 pr-12">
            <div className="flex min-h-11 items-start justify-between gap-3">
              <DialogTitle className="text-lg">{t("shortcuts_help.title")}</DialogTitle>
              <DialogClose
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={tCommon(["dialog_close", "close"])}
                    className="-mr-2 -mt-2 shrink-0"
                  />
                }
              >
                <XIcon aria-hidden="true" />
              </DialogClose>
            </div>
            <DialogDescription className="flex flex-wrap items-center gap-2">
              <span>{t("shortcuts_help.description")}</span>
              <Kbd className="border-border/70 bg-surface-1/72">?</Kbd>
            </DialogDescription>
          </DialogHeader>
        </div>

        <Command shouldFilter={true} label={t("shortcuts_help.placeholder")} className="max-h-none rounded-none">
          <CommandInput
            value={searchValue}
            onValueChange={setSearchValue}
            aria-label={t("shortcuts_help.placeholder")}
            placeholder={t("shortcuts_help.placeholder")}
            autoFocus
          />
          <CommandList
            key={searchValue.trim().toLowerCase()}
            label={t("shortcuts_help.results_label")}
            data-testid="shortcuts-help-results"
            data-motion-phase="entering"
            className={`${MOTION_CONTENT_SWAP_CLASS_NAME} max-h-[360px]`}
          >
            {shortcutsByCategory.map((category) => {
              const visibleItems = category.items;

              return visibleItems.length > 0 ? (
                <CommandGroup key={category.categoryKey} heading={category.heading}>
                  {visibleItems.map((shortcut) => (
                    <CommandItem
                      key={shortcut.definition.id}
                      value={shortcut.searchValue}
                      className="min-h-11 flex-col items-start gap-1.5 sm:flex-row sm:items-center"
                    >
                      <span className="min-w-0">{shortcut.label}</span>
                      <Kbd className="ml-0 sm:ml-auto">{shortcut.displayKey}</Kbd>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null;
            })}
            <CommandEmpty>{t("shortcuts_help.no_results")}</CommandEmpty>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
