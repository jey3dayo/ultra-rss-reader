import { describe, expect, it } from "vitest";
import {
  type ArticleDisplayPreset,
  appDefaultsToDisplayPreset,
  displayPresetToModes,
  displayPresetToPreferenceValues,
  displayPresetToTriStateModes,
  feedModesToDisplayPresetOption,
  modesToDisplayPreset,
  resolveArticleDisplay,
} from "@/lib/article-display";

describe("article-display preset conversions", () => {
  it.each([
    ["reader_only", { readerMode: true, webPreviewMode: false }],
    ["reader_and_preview", { readerMode: true, webPreviewMode: true }],
    ["preview_only", { readerMode: false, webPreviewMode: true }],
  ] satisfies Array<
    [ArticleDisplayPreset, { readerMode: boolean; webPreviewMode: boolean }]
  >)("converts preset %s into two display axes", (preset, expected) => {
    expect(displayPresetToModes(preset)).toEqual(expected);
  });

  it("converts two enabled modes back into their display preset", () => {
    expect(modesToDisplayPreset({ readerMode: true, webPreviewMode: false })).toBe("reader_only");
    expect(modesToDisplayPreset({ readerMode: true, webPreviewMode: true })).toBe("reader_and_preview");
    expect(modesToDisplayPreset({ readerMode: false, webPreviewMode: true })).toBe("preview_only");
  });

  it("converts display presets into persisted app default preference values", () => {
    expect(displayPresetToPreferenceValues("reader_only")).toEqual({
      reader_mode_default: "true",
      web_preview_mode_default: "false",
    });
    expect(displayPresetToPreferenceValues("reader_and_preview")).toEqual({
      reader_mode_default: "true",
      web_preview_mode_default: "true",
    });
    expect(displayPresetToPreferenceValues("preview_only")).toEqual({
      reader_mode_default: "false",
      web_preview_mode_default: "true",
    });
  });

  it("reconstructs the display preset from persisted app default values", () => {
    expect(appDefaultsToDisplayPreset("true", "false")).toBe("reader_only");
    expect(appDefaultsToDisplayPreset("true", "true")).toBe("reader_and_preview");
    expect(appDefaultsToDisplayPreset("false", "true")).toBe("preview_only");
  });

  it("converts feed UI preset options into tri-state feed modes", () => {
    expect(displayPresetToTriStateModes("default")).toEqual({
      readerMode: "inherit",
      webPreviewMode: "inherit",
    });
    expect(displayPresetToTriStateModes("reader_only")).toEqual({
      readerMode: "on",
      webPreviewMode: "off",
    });
    expect(displayPresetToTriStateModes("reader_and_preview")).toEqual({
      readerMode: "on",
      webPreviewMode: "on",
    });
    expect(displayPresetToTriStateModes("preview_only")).toEqual({
      readerMode: "off",
      webPreviewMode: "on",
    });
  });

  it("maps feed tri-state settings back to the feed preset selector value", () => {
    expect(feedModesToDisplayPresetOption("inherit", "inherit")).toBe("default");
    expect(feedModesToDisplayPresetOption("on", "off")).toBe("reader_only");
    expect(feedModesToDisplayPresetOption("on", "on")).toBe("reader_and_preview");
    expect(feedModesToDisplayPresetOption("off", "on")).toBe("preview_only");
  });
});

describe("resolveArticleDisplay", () => {
  it("resolves app defaults without overrides", () => {
    expect(
      resolveArticleDisplay({
        appDefault: { readerMode: true, webPreviewMode: false },
        feedOverride: { readerMode: "inherit", webPreviewMode: "inherit" },
        temporaryOverride: { readerMode: null, webPreviewMode: null },
        articleCapabilities: { hasWebPreview: true },
      }),
    ).toMatchObject({
      readerMode: true,
      webPreviewMode: false,
      preset: "reader_only",
      fallbackReason: null,
    });
  });

  it("lets feed overrides replace app defaults before temporary state", () => {
    expect(
      resolveArticleDisplay({
        appDefault: { readerMode: true, webPreviewMode: false },
        feedOverride: { readerMode: "on", webPreviewMode: "on" },
        temporaryOverride: { readerMode: "off", webPreviewMode: null },
        articleCapabilities: { hasWebPreview: true },
      }),
    ).toMatchObject({
      readerMode: false,
      webPreviewMode: true,
      preset: "preview_only",
      fallbackReason: null,
    });
  });

  it("falls back to reader only when preview was requested but the article has no preview URL", () => {
    expect(
      resolveArticleDisplay({
        appDefault: { readerMode: false, webPreviewMode: true },
        feedOverride: { readerMode: "inherit", webPreviewMode: "inherit" },
        temporaryOverride: { readerMode: null, webPreviewMode: null },
        articleCapabilities: { hasWebPreview: false },
      }),
    ).toMatchObject({
      readerMode: true,
      webPreviewMode: false,
      preset: "reader_only",
      fallbackReason: "missing_web_preview",
    });
  });

  it("never returns an invalid state where both reader and preview are disabled", () => {
    expect(
      resolveArticleDisplay({
        appDefault: { readerMode: true, webPreviewMode: false },
        feedOverride: { readerMode: "inherit", webPreviewMode: "inherit" },
        temporaryOverride: { readerMode: "off", webPreviewMode: "off" },
        articleCapabilities: { hasWebPreview: true },
      }),
    ).toMatchObject({
      readerMode: true,
      webPreviewMode: false,
      preset: "reader_only",
      fallbackReason: "invalid_empty_display",
    });
  });
});
