const DEV_WEB_PREVIEW_GEOMETRY_PATH = "/dev-web-preview-geometry.html";

export function resolveDevWebPreviewGeometryUrl(): string {
  if (typeof window === "undefined") {
    return DEV_WEB_PREVIEW_GEOMETRY_PATH;
  }

  return new URL(DEV_WEB_PREVIEW_GEOMETRY_PATH, window.location.origin).toString();
}
