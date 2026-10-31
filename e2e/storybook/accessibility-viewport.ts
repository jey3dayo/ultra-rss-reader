import { MINIMAL_VIEWPORTS, RESPONSIVE_VIEWPORT_VALUE } from "storybook/viewport";
import { storybookViewportMaxDimensionPx } from "./storybook-index-payload";

export type StorybookAccessibilityViewport = {
  width: number;
  height: number;
};

export type StorybookAccessibilityViewportContext = {
  globals: unknown;
  storyGlobals: unknown;
  userGlobals: unknown;
  parameters: unknown;
};

type ViewportGlobal = {
  value: string | undefined;
  isRotated: boolean | undefined;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getProperty(record: unknown, key: string): unknown {
  return isRecord(record) ? Reflect.get(record, key) : undefined;
}

function hasProperty(record: unknown, key: string): boolean {
  return isRecord(record) && Object.hasOwn(record, key);
}

function getViewportGlobal(value: unknown, storyId: string, source: string): ViewportGlobal | undefined {
  if (typeof value === "string") return { value, isRotated: undefined };
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) {
    throw new Error(`Story "${storyId}" has an invalid ${source} viewport global`);
  }

  const viewportValue = Reflect.get(value, "value");
  const isRotated = Reflect.get(value, "isRotated");
  if (viewportValue !== undefined && typeof viewportValue !== "string") {
    throw new Error(`Story "${storyId}" has a non-string ${source} viewport value`);
  }
  if (isRotated !== undefined && typeof isRotated !== "boolean") {
    throw new Error(`Story "${storyId}" has a non-boolean ${source} viewport rotation`);
  }

  return {
    value: viewportValue,
    isRotated,
  };
}

function getViewportParameters(parameters: unknown, storyId: string): Record<string, unknown> {
  const viewportParameters = getProperty(parameters, "viewport");
  if (viewportParameters === undefined || viewportParameters === null) return {};
  if (!isRecord(viewportParameters)) {
    throw new Error(`Story "${storyId}" has invalid parameters.viewport`);
  }

  return viewportParameters;
}

function getViewportOptions(viewportParameters: Record<string, unknown>, storyId: string): Record<string, unknown> {
  const options = Reflect.get(viewportParameters, "options");
  if (options === undefined || options === null) return MINIMAL_VIEWPORTS;
  if (!isRecord(options)) {
    throw new Error(`Story "${storyId}" parameters.viewport.options must be an object`);
  }

  return options;
}

function getGlobalViewportValue(
  context: StorybookAccessibilityViewportContext,
  storyId: string,
): { value: string | undefined; isRotated: boolean } {
  const storyHasViewport = hasProperty(context.storyGlobals, "viewport");
  const globalOrder = storyHasViewport
    ? [
        getViewportGlobal(getProperty(context.storyGlobals, "viewport"), storyId, "story"),
        getViewportGlobal(getProperty(context.userGlobals, "viewport"), storyId, "user"),
        getViewportGlobal(getProperty(context.globals, "viewport"), storyId, "initial"),
      ]
    : [
        getViewportGlobal(getProperty(context.userGlobals, "viewport"), storyId, "user"),
        getViewportGlobal(getProperty(context.storyGlobals, "viewport"), storyId, "story"),
        getViewportGlobal(getProperty(context.globals, "viewport"), storyId, "initial"),
      ];
  const value = globalOrder.find((global) => global?.value !== undefined)?.value;
  const isRotated = globalOrder.find((global) => global?.isRotated !== undefined)?.isRotated ?? false;

  return { value, isRotated };
}

function parseDimension(value: unknown, storyId: string, viewportId: string, axis: "width" | "height"): number {
  if (typeof value !== "string") {
    throw new Error(`Story "${storyId}" viewport "${viewportId}" must define a string ${axis}`);
  }

  const match = /^(\d+(?:\.\d+)?)(px)?$/.exec(value);
  const pixels = match?.[1] === undefined ? Number.NaN : Number(match[1]);
  if (!Number.isFinite(pixels) || pixels <= 0 || pixels > storybookViewportMaxDimensionPx) {
    throw new Error(
      `Story "${storyId}" viewport "${viewportId}" has unsupported ${axis} "${value}"; expected a positive pixel value up to ${storybookViewportMaxDimensionPx}`,
    );
  }

  return Math.round(pixels);
}

function resolveCustomViewport(value: string, storyId: string): StorybookAccessibilityViewport | undefined {
  const match = /^(\d{1,4})([a-z]{0,4})-(\d{1,4})([a-z]{0,4})$/.exec(value);
  if (!match) return undefined;

  const [, widthValue, widthUnit, heightValue, heightUnit] = match;
  if (widthValue === undefined || widthUnit === undefined || heightValue === undefined || heightUnit === undefined) {
    throw new Error(`Story "${storyId}" has an invalid custom viewport value "${value}"`);
  }
  if (!["", "px"].includes(widthUnit) || !["", "px"].includes(heightUnit)) {
    throw new Error(`Story "${storyId}" custom viewport "${value}" must use pixel dimensions`);
  }

  const width = Math.max(Number(widthValue), 40);
  const height = Math.max(Number(heightValue), 40);
  return { width, height };
}

function rotateViewport(viewport: StorybookAccessibilityViewport, isRotated: boolean): StorybookAccessibilityViewport {
  return isRotated ? { width: viewport.height, height: viewport.width } : viewport;
}

export function resolveStorybookAccessibilityViewport(
  storyId: string,
  context: StorybookAccessibilityViewportContext,
): StorybookAccessibilityViewport | undefined {
  const viewportParameters = getViewportParameters(context.parameters, storyId);
  const options = getViewportOptions(viewportParameters, storyId);
  const global = getGlobalViewportValue(context, storyId);
  const legacyDefaultViewport = Reflect.get(viewportParameters, "defaultViewport");
  const value = global.value ?? legacyDefaultViewport;

  if (
    value === undefined ||
    value === null ||
    value === "" ||
    value === "responsive" ||
    value === RESPONSIVE_VIEWPORT_VALUE
  ) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`Story "${storyId}" has an invalid viewport id in globals or parameters.viewport.defaultViewport`);
  }

  const customViewport = resolveCustomViewport(value, storyId);
  if (customViewport) return rotateViewport(customViewport, global.isRotated);

  const option = getProperty(options, value);
  if (option === undefined) {
    throw new Error(`Story "${storyId}" references unknown viewport id "${value}"`);
  }
  const styles = getProperty(option, "styles");
  const viewport = {
    width: parseDimension(getProperty(styles, "width"), storyId, value, "width"),
    height: parseDimension(getProperty(styles, "height"), storyId, value, "height"),
  };

  return rotateViewport(viewport, global.isRotated);
}
