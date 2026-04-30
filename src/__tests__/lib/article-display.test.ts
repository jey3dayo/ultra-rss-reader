import { describe, expect, it } from "vitest";
import {
  type ArticleDisplayPreset,
  appDefaultsToDisplayPreset,
  buildFeedDisplayPresetOptions,
  displayPresetToModes,
  displayPresetToPreferenceValues,
  displayPresetToTriStateModes,
  feedModesToDisplayPresetOption,
  isArticleDisplayPreset,
  isFeedDisplayPresetOption,
  isTriStateDisplayMode,
  modesToDisplayPreset,
  resolveArticleDisplay,
  resolveFeedDisplayOverrides,
  resolveFeedDisplayPresetLabel,
  resolveFolderDisplayPreset,
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

  it.each([
    ["default", "Use default"],
    ["standard", "Standard"],
    ["preview", "Preview"],
  ] as const)("resolves feed display preset %s labels", (preset, expected) => {
    expect(
      resolveFeedDisplayPresetLabel({
        preset,
        labels: {
          default: "Use default",
          standard: "Standard",
          preview: "Preview",
        },
      }),
    ).toBe(expected);
  });

  it("builds feed display preset options in selector order", () => {
    expect(
      buildFeedDisplayPresetOptions({
        default: "Use default",
        standard: "Standard",
        preview: "Preview",
      }),
    ).toEqual([
      { value: "default", label: "Use default" },
      { value: "standard", label: "Standard" },
      { value: "preview", label: "Preview" },
    ]);
  });

  it("resolves folder display preset only when child feeds match", () => {
    expect(resolveFolderDisplayPreset([])).toBe("default");
    expect(
      resolveFolderDisplayPreset([
        { reader_mode: "inherit", web_preview_mode: "inherit" },
        { reader_mode: "inherit", web_preview_mode: "inherit" },
      ]),
    ).toBe("default");
    expect(
      resolveFolderDisplayPreset([
        { reader_mode: "on", web_preview_mode: "off" },
        { reader_mode: "on", web_preview_mode: "on" },
      ]),
    ).toBeNull();
  });

  it("narrows unknown values to feed display preset options", () => {
    expect(isFeedDisplayPresetOption("default")).toBe(true);
    expect(isFeedDisplayPresetOption("standard")).toBe(true);
    expect(isFeedDisplayPresetOption("preview")).toBe(true);
    expect(isFeedDisplayPresetOption("custom")).toBe(false);
    expect(isFeedDisplayPresetOption("")).toBe(false);
  });

  it("narrows unknown values to app display presets", () => {
    expect(isArticleDisplayPreset("standard")).toBe(true);
    expect(isArticleDisplayPreset("preview")).toBe(true);
    expect(isArticleDisplayPreset("default")).toBe(false);
    expect(isArticleDisplayPreset("custom")).toBe(false);
  });

  it("narrows unknown values to tri-state display modes", () => {
    expect(isTriStateDisplayMode("inherit")).toBe(true);
    expect(isTriStateDisplayMode("on")).toBe(true);
    expect(isTriStateDisplayMode("off")).toBe(true);
    expect(isTriStateDisplayMode("default")).toBe(false);
    expect(isTriStateDisplayMode(null)).toBe(false);
  });

  it("falls feed display overrides back to inherit when persisted values are invalid", () => {
    expect(resolveFeedDisplayOverrides({ reader_mode: "on", web_preview_mode: "off" })).toEqual({
      readerMode: "on",
      webPreviewMode: "off",
    });
    expect(resolveFeedDisplayOverrides({ reader_mode: "on", web_preview_mode: "custom" })).toEqual({
      readerMode: "inherit",
      webPreviewMode: "inherit",
    });
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
