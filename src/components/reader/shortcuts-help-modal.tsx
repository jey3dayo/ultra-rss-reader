import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getShortcutDisplay, type ShortcutDefinition, shortcutDefinitions } from "@/lib/keyboard-shortcuts";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import type { ShortcutsHelpModalProps } from "./shortcuts-help-modal.types";

const CATEGORY_ORDER: ShortcutDefinition["categoryKey"][] = [
  "shortcuts.category_navigation",
  "shortcuts.category_actions",
  "shortcuts.category_global",
];

type ShortcutHelpItem = {
  definition: ShortcutDefinition;
  label: string;
  displayKey: string;
  searchValue: string;
};

export function ShortcutsHelpModal({ open, onOpenChange }: ShortcutsHelpModalProps) {
  const { t } = useTranslation("reader");
  const platformKind = usePlatformStore((state) => state.platform.kind);
  const shortcutPrefs = usePreferencesStore((state) => state.prefs);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-2xl" showCloseButton={false}>
        <div className="border-b px-4 py-4">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-lg">{t("shortcuts_help.title")}</DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2">
              <span>{t("shortcuts_help.description")}</span>
              <kbd className="text-muted-foreground rounded-md border px-2 py-0.5 font-mono text-xs">?</kbd>
            </DialogDescription>
          </DialogHeader>
        </div>

        <Command shouldFilter={true} className="max-h-none rounded-none">
          <CommandInput placeholder={t("shortcuts_help.placeholder")} />
          <CommandList className="max-h-[360px]">
            {shortcutsByCategory.map((category) => {
              const visibleItems = category.items;

              return visibleItems.length > 0 ? (
                <CommandGroup key={category.categoryKey} heading={category.heading}>
                  {visibleItems.map((shortcut) => (
                    <CommandItem
                      key={shortcut.definition.id}
                      value={shortcut.searchValue}
                      className="flex-col items-start gap-1.5 sm:flex-row sm:items-center"
                    >
                      <span>{shortcut.label}</span>
                      <CommandShortcut className="ml-0 sm:ml-auto">{shortcut.displayKey}</CommandShortcut>
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
