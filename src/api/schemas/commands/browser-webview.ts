import { z } from "zod";
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

const devWebPreviewGeometryFixtureUrlSchema = z.string().trim().refine(isDevWebPreviewGeometryFixtureUrl, {
  message: "Only the dev web preview geometry fixture may target localhost",
});
const browserWebviewUrlSchema = z.union([readingListUrlSchema, devWebPreviewGeometryFixtureUrlSchema]);

export const checkBrowserEmbedSupportArgs = z.object({ url: readingListUrlSchema });

const geometryIntegerSchema = z
  .number()
  .finite()
  .int()
  .transform((value) => (Object.is(value, -0) ? 0 : value));
const browserWebviewCoordinateSchema = geometryIntegerSchema.pipe(
  z.number().nonnegative().max(BROWSER_WEBVIEW_BOUNDS_MAX_VALUE),
);
const positiveGeometryIntegerSchema = geometryIntegerSchema.pipe(
  z.number().positive().max(BROWSER_WEBVIEW_BOUNDS_MAX_VALUE),
);

export const browserWebviewBoundsArgs = z.object({
  x: browserWebviewCoordinateSchema,
  y: browserWebviewCoordinateSchema,
  width: positiveGeometryIntegerSchema,
  height: positiveGeometryIntegerSchema,
  unit: z.enum(["logical", "physical"]).optional(),
});
export const createOrUpdateBrowserWebviewArgs = z.object({
  url: browserWebviewUrlSchema,
  bounds: browserWebviewBoundsArgs,
});
export const setBrowserWebviewBoundsArgs = z.object({
  bounds: browserWebviewBoundsArgs,
});
