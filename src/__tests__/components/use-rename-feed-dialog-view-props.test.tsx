import { renderHook } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import type { RenameFeedDialogController } from "@/components/reader/rename-feed-dialog.types";
import { useRenameFeedDialogViewProps } from "@/components/reader/use-rename-feed-dialog-view-props";
import i18n from "@/lib/i18n";

const t = i18n.getFixedT("en", "reader");
const tc = i18n.getFixedT("en", "common");

function createController(overrides: Partial<RenameFeedDialogController> = {}): RenameFeedDialogController {
  return {
    title: "Daily Feed",
    loading: false,
    displayPreset: "default",
    inputRef: createRef<HTMLInputElement>(),
    folders: [],
    setTitle: vi.fn(),
    setDisplayPreset: vi.fn(),
    handleCopy: vi.fn(async () => {}),
    handleSubmit: vi.fn(async () => {}),
    folderSelectProps: {
      folderSelectValue: "folder_1",
      folderOptions: [{ value: "folder_1", label: "News" }],
      isCreatingFolder: false,
      newFolderName: "",
      newFolderInputRef: createRef<HTMLInputElement>(),
      handleFolderChange: vi.fn(),
      setNewFolderName: vi.fn(),
    },
    ...overrides,
  };
}

describe("useRenameFeedDialogViewProps", () => {
  it("maps dialog labels, readonly URL copy actions, and folder select props", () => {
    const controller = createController();
    const onOpenChange = vi.fn();

    const { result } = renderHook(() =>
      useRenameFeedDialogViewProps({
        open: true,
        feedSiteUrl: "https://example.com",
        feedUrl: "https://example.com/feed.xml",
        onOpenChange,
        folderLabelId: "folder-label",
        controller,
      }),
    );

    expect(result.current).toEqual(
      expect.objectContaining({
        open: true,
        title: "Daily Feed",
        loading: false,
        displayMode: "default",
        onOpenChange,
        onTitleChange: controller.setTitle,
        inputRef: controller.inputRef,
        onSubmit: controller.handleSubmit,
        labels: {
          title: t("edit_feed"),
          titleField: t("title"),
          displayMode: t("display_mode"),
          cancel: tc("cancel"),
          save: tc("save"),
          saving: tc("saving"),
        },
      }),
    );
    expect(result.current.displayModeOptions).toEqual([
      { value: "default", label: t("display_mode_default") },
      { value: "standard", label: t("display_mode_standard") },
      { value: "preview", label: t("display_mode_preview") },
    ]);
    expect(result.current.folderSelectProps).toEqual(
      expect.objectContaining({
        labelId: "folder-label",
        label: t("folder"),
        value: "folder_1",
        options: [{ value: "folder_1", label: "News" }],
        canCreateFolder: true,
        disabled: false,
        newFolderOptionLabel: t("new_folder"),
        newFolderLabel: t("folder_name"),
        newFolderPlaceholder: t("enter_folder_name"),
      }),
    );

    const copyWebsiteUrl = result.current.urlFields[0]?.onCopy;
    const copyFeedUrl = result.current.urlFields[1]?.onCopy;

    if (!copyWebsiteUrl || !copyFeedUrl) {
      throw new Error("Missing URL copy action");
    }

    copyWebsiteUrl();
    copyFeedUrl();

    expect(controller.handleCopy).toHaveBeenCalledWith("https://example.com");
    expect(controller.handleCopy).toHaveBeenCalledWith("https://example.com/feed.xml");
  });

  it("only accepts supported display preset values", () => {
    const setDisplayPreset = vi.fn();
    const controller = createController({ setDisplayPreset });

    const { result } = renderHook(() =>
      useRenameFeedDialogViewProps({
        open: false,
        feedSiteUrl: "",
        feedUrl: "",
        onOpenChange: vi.fn(),
        folderLabelId: "folder-label",
        controller,
      }),
    );

    result.current.onDisplayModeChange("reader");
    expect(setDisplayPreset).not.toHaveBeenCalled();

    result.current.onDisplayModeChange("preview");
    expect(setDisplayPreset).toHaveBeenCalledWith("preview");
  });
});
