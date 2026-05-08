import { describe, expect, it } from "vitest";
import enReader from "@/locales/en/reader.json";
import jaReader from "@/locales/ja/reader.json";

type MenuShortcutLabelContract = {
  actionId: string;
  enShortcutLabel: string;
  jaShortcutLabel: string;
};

const browserAndCopyLabelContracts: MenuShortcutLabelContract[] = [
  {
    actionId: "open-in-browser",
    enShortcutLabel: enReader.shortcuts.view_in_browser,
    jaShortcutLabel: jaReader.shortcuts.view_in_browser,
  },
  {
    actionId: "open-in-default-browser",
    enShortcutLabel: enReader.shortcuts.open_external_browser,
    jaShortcutLabel: jaReader.shortcuts.open_external_browser,
  },
  {
    actionId: "copy-link",
    enShortcutLabel: enReader.copy_link,
    jaShortcutLabel: jaReader.copy_link,
  },
];

describe("menu i18n shortcut label parity", () => {
  it("keeps native menu browser and copy action vocabulary aligned with frontend labels", () => {
    expect(browserAndCopyLabelContracts).toEqual([
      {
        actionId: "open-in-browser",
        enShortcutLabel: "Open Web Preview",
        jaShortcutLabel: "Webプレビューを開く",
      },
      {
        actionId: "open-in-default-browser",
        enShortcutLabel: "Open in external browser",
        jaShortcutLabel: "外部ブラウザで開く",
      },
      {
        actionId: "copy-link",
        enShortcutLabel: "Copy link",
        jaShortcutLabel: "リンクをコピー",
      },
    ]);
  });
});
