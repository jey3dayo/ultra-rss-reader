import * as v from "valibot";
import * as s from "@/api/schemas/validation";
import { BROWSER_WEBVIEW_BOUNDS_MAX_VALUE } from "./shared";
import { parseHttpUrl, readingListUrlSchema } from "./url";

function isDevWebPreviewGeometryFixtureUrl(value: string): boolean {
  const url = parseHttpUrl(value);
  if (url == null) {
    return false;
  }

  const host = url.hostname.toLowerCase().replace(/\.+$/u, "");
  return (
    (host === "localhost" || host === "127.0.0.1" || host === "::1") &&
    url.pathname === "/dev-web-preview-geometry.html" &&
    url.search === "" &&
    url.hash === "" &&
    url.username === "" &&
    url.password === ""
  );
}

const devWebPreviewGeometryFixtureUrlSchema = v.pipe(
  v.string(),
  v.trim(),
  v.check(isDevWebPreviewGeometryFixtureUrl, "Only the dev web preview geometry fixture may target localhost"),
);
const browserWebviewUrlSchema = v.union([readingListUrlSchema, devWebPreviewGeometryFixtureUrlSchema]);

export const checkBrowserEmbedSupportArgs = s.object({ url: readingListUrlSchema });

const geometryIntegerSchema = v.pipe(
  v.number(),
  v.finite(),
  v.integer(),
  v.transform((value) => (Object.is(value, -0) ? 0 : value)),
);
const browserWebviewCoordinateSchema = v.pipe(
  geometryIntegerSchema,
  v.minValue(0),
  v.maxValue(BROWSER_WEBVIEW_BOUNDS_MAX_VALUE),
);
const positiveGeometryIntegerSchema = v.pipe(
  geometryIntegerSchema,
  v.gtValue(0),
  v.maxValue(BROWSER_WEBVIEW_BOUNDS_MAX_VALUE),
);

export const browserWebviewBoundsArgs = s.object({
  x: browserWebviewCoordinateSchema,
  y: browserWebviewCoordinateSchema,
  width: positiveGeometryIntegerSchema,
  height: positiveGeometryIntegerSchema,
  unit: v.optional(v.picklist(["logical", "physical"])),
});
export const createOrUpdateBrowserWebviewArgs = s.object({
  url: browserWebviewUrlSchema,
  bounds: browserWebviewBoundsArgs,
});
export const setBrowserWebviewBoundsArgs = s.object({
  bounds: browserWebviewBoundsArgs,
});
