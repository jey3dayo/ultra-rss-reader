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
    ["standard", { readerMode: true, webPreviewMode: false }],
    ["preview", { readerMode: true, webPreviewMode: true }],
  ] satisfies Array<
    [ArticleDisplayPreset, { readerMode: boolean; webPreviewMode: boolean }]
  >)("converts preset %s into two display axes", (preset, expected) => {
    expect(displayPresetToModes(preset)).toEqual(expected);
  });

  it("converts two enabled modes back into their display preset", () => {
    expect(modesToDisplayPreset({ readerMode: true, webPreviewMode: false })).toBe("standard");
    expect(modesToDisplayPreset({ readerMode: true, webPreviewMode: true })).toBe("preview");
    expect(modesToDisplayPreset({ readerMode: false, webPreviewMode: true })).toBe("preview");
  });

  it("converts display presets into persisted app default preference values", () => {
    expect(displayPresetToPreferenceValues("standard")).toEqual({
      reader_mode_default: "true",
      web_preview_mode_default: "false",
    });
    expect(displayPresetToPreferenceValues("preview")).toEqual({
      reader_mode_default: "true",
      web_preview_mode_default: "true",
    });
  });

  it("reconstructs the display preset from persisted app default values", () => {
    expect(appDefaultsToDisplayPreset("true", "false")).toBe("standard");
    expect(appDefaultsToDisplayPreset("true", "true")).toBe("preview");
    expect(appDefaultsToDisplayPreset("false", "true")).toBe("preview");
  });

  it("converts feed UI preset options into tri-state feed modes", () => {
    expect(displayPresetToTriStateModes("default")).toEqual({
      readerMode: "inherit",
      webPreviewMode: "inherit",
    });
    expect(displayPresetToTriStateModes("standard")).toEqual({
      readerMode: "on",
      webPreviewMode: "off",
    });
    expect(displayPresetToTriStateModes("preview")).toEqual({
      readerMode: "on",
      webPreviewMode: "on",
    });
  });

  it("maps feed tri-state settings back to the feed preset selector value", () => {
    expect(feedModesToDisplayPresetOption("inherit", "inherit")).toBe("default");
    expect(feedModesToDisplayPresetOption("on", "off")).toBe("standard");
    expect(feedModesToDisplayPresetOption("on", "on")).toBe("preview");
    expect(feedModesToDisplayPresetOption("off", "on")).toBe("preview");
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
      preset: "standard",
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
      preset: "preview",
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
      preset: "standard",
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
      preset: "standard",
      fallbackReason: "invalid_empty_display",
    });
  });
});
