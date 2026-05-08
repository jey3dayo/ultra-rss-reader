type DevWebPreviewGeometryRail = {
  cssVariable: string;
  color: string;
  label: string;
};

export type DevWebPreviewGeometryFixture = {
  path: string;
  summary: {
    title: string;
    description: string;
  };
  rails: {
    left: DevWebPreviewGeometryRail;
    right: DevWebPreviewGeometryRail;
  };
  checks: {
    title: string;
    description: string;
  }[];
};

export function createDevWebPreviewGeometryFixture(): DevWebPreviewGeometryFixture {
  return {
    path: "/dev-web-preview-geometry.html",
    summary: {
      title: "native webview should touch both colored rails",
      description: "if either rail disappears or turns into app background, geometry is still wrong",
    },
    rails: {
      left: {
        cssVariable: "--edge-left",
        color: "#2563eb",
        label: "left edge",
      },
      right: {
        cssVariable: "--edge-right",
        color: "#f43f5e",
        label: "right edge",
      },
    },
    checks: [
      {
        title: "Width Check",
        description:
          "The blue and pink rails are pinned to the browser surface edges, not to a centered content column.",
      },
      {
        title: "Chrome Check",
        description:
          "The app close button should float above this page without drifting off-center or getting clipped.",
      },
      {
        title: "Overlay Check",
        description:
          "The top rail should feel intentional but almost invisible, with the page still reading as immersive.",
      },
    ],
  };
}

export function resolveDevWebPreviewGeometryUrl(): string {
  const { path } = createDevWebPreviewGeometryFixture();

  if (typeof window === "undefined") {
    return path;
  }

  return new URL(path, window.location.origin).toString();
}
