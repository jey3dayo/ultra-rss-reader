import { SectionHeading } from "@/components/settings/settings-components";

interface ShortcutEntry {
  category: string;
  shortcut: string;
  action: string;
}

const shortcutEntries: ShortcutEntry[] = [
  { category: "Navigation", shortcut: "j", action: "Next article" },
  { category: "Navigation", shortcut: "k", action: "Previous article" },
  { category: "Navigation", shortcut: "u", action: "Focus sidebar" },
  { category: "Actions", shortcut: "m", action: "Toggle read / unread" },
  { category: "Actions", shortcut: "s", action: "Toggle star" },
  { category: "Actions", shortcut: "v", action: "View in browser" },
  { category: "Actions", shortcut: "b", action: "Open in external browser" },
  { category: "Actions", shortcut: "r", action: "Sync all feeds" },
  { category: "Actions", shortcut: "Shift + R", action: "Sync current feed" },
  { category: "Actions", shortcut: "a", action: "Mark all as read" },
  { category: "Actions", shortcut: "f", action: "Cycle filter (All / Unread / Starred)" },
  { category: "Global", shortcut: "/", action: "Search" },
  { category: "Global", shortcut: "Escape", action: "Close browser / clear selection" },
  { category: "Global", shortcut: "\u2318 ,", action: "Open settings" },
];

export function ShortcutsSettings() {
  const categories = [...new Set(shortcutEntries.map((s) => s.category))];

  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">Shortcuts</h2>

      {categories.map((cat) => (
        <section key={cat} className="mb-6">
          <SectionHeading>{cat}</SectionHeading>
          {shortcutEntries
            .filter((s) => s.category === cat)
            .map((s) => (
              <div
                key={s.shortcut}
                className="flex min-h-[44px] items-center justify-between border-b border-border py-3"
              >
                <span className="text-sm text-foreground">{s.action}</span>
                <kbd className="rounded border border-border bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
                  {s.shortcut}
                </kbd>
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}
