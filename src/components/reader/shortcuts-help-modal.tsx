import { SearchIcon, XIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MOTION_CONTENT_SWAP_CLASS_NAME } from "@/constants/motion";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Kbd,
  ScrollArea,
  SectionHeading,
  SurfaceCard,
} from "@/design-system";
import { useStableOpenTranslation } from "@/lib/i18n/use-stable-open-translation";
import { getShortcutDisplay, type ShortcutDefinition, shortcutDefinitions } from "@/lib/keyboard/keyboard-shortcuts";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

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

  const normalizedQuery = searchValue.trim().toLowerCase();

  const visibleCategories = useMemo(
    () =>
      CATEGORY_ORDER.map((categoryKey) => ({
        categoryKey,
        heading: t(categoryKey),
        items: shortcuts.filter(
          (shortcut) =>
            shortcut.definition.categoryKey === categoryKey && shortcut.searchValue.includes(normalizedQuery),
        ),
      })).filter((category) => category.items.length > 0),
    [normalizedQuery, shortcuts, t],
  );

  const commandPaletteKey = getShortcutDisplay("open_command_palette", shortcutPrefs, platformKind);

  const handleEditBindings = useCallback(() => {
    handleOpenChange(false);
    useUiStore.getState().openSettings("shortcuts");
  }, [handleOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl" showCloseButton={false}>
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
          <div className="relative mt-3">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-soft"
            />
            <Input
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.currentTarget.value)}
              aria-label={t("shortcuts_help.placeholder")}
              placeholder={t("shortcuts_help.placeholder")}
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        <section
          key={normalizedQuery}
          data-testid="shortcuts-help-results"
          data-motion-phase="entering"
          aria-label={t("shortcuts_help.results_label")}
          className={MOTION_CONTENT_SWAP_CLASS_NAME}
        >
          <ScrollArea keyboardScrollable className="flex max-h-[min(30rem,60dvh)] flex-col" contentClassName="p-4">
            {visibleCategories.length > 0 ? (
              <div className="grid items-start gap-3 sm:grid-cols-2">
                {[0, 1].map((columnIndex) => (
                  <div key={columnIndex} className="grid gap-3 empty:hidden">
                    {visibleCategories
                      .filter((_, categoryIndex) => categoryIndex % 2 === columnIndex)
                      .map((category) => (
                        <SurfaceCard key={category.categoryKey} variant="section" padding="compact">
                          <SectionHeading className="mb-1">{category.heading}</SectionHeading>
                          <table aria-label={category.heading} className="w-full border-collapse">
                            <tbody>
                              {category.items.map((shortcut) => (
                                <tr
                                  key={shortcut.definition.id}
                                  className="h-10 border-b border-border/55 last:border-b-0"
                                >
                                  <th
                                    scope="row"
                                    className="py-1.5 pr-4 text-left font-sans text-[13px] leading-[1.35] font-medium text-[color:var(--form-row-label)]"
                                  >
                                    {shortcut.label}
                                  </th>
                                  <td className="py-1.5 text-right whitespace-nowrap">
                                    <Kbd>{shortcut.displayKey}</Kbd>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </SurfaceCard>
                      ))}
                  </div>
                ))}
              </div>
            ) : (
              <p role="status" aria-live="polite" className="py-8 text-center text-sm text-foreground-soft">
                {t("shortcuts_help.no_results")}
              </p>
            )}
          </ScrollArea>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t px-4 py-2.5 text-xs text-foreground-soft">
          <span className="flex items-center gap-2">
            {t("shortcuts_help.run_hint")}
            <Kbd>{commandPaletteKey}</Kbd>
          </span>
          <Button type="button" variant="link" size="xs" className="px-0" onClick={handleEditBindings}>
            {t("shortcuts_help.edit_bindings")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
