import { useCallback, useMemo, useState } from "react";
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
import { MOTION_CONTENT_SWAP_CLASS_NAME } from "@/constants/motion";
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
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-lg">{t("shortcuts_help.title")}</DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2">
              <span>{t("shortcuts_help.description")}</span>
              <kbd className="rounded-md border border-border/70 bg-surface-1/72 px-2 py-0.5 font-mono text-xs text-foreground-soft">
                ?
              </kbd>
            </DialogDescription>
          </DialogHeader>
        </div>

        <Command shouldFilter={true} className="max-h-none rounded-none">
          <CommandInput
            value={searchValue}
            onValueChange={setSearchValue}
            placeholder={t("shortcuts_help.placeholder")}
          />
          <CommandList
            key={searchValue.trim().toLowerCase()}
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
