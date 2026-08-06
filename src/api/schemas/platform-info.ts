import * as v from "valibot";
import * as s from "@/api/schemas/validation";
import { DEFAULT_PLATFORM_INFO, PLATFORM_KINDS, type PlatformInfoShape, type PlatformKind } from "@/constants/platform";

export type PlatformInfo = PlatformInfoShape;

// Capabilities are part of PlatformInfo; keep the nested schema local until callers need a standalone contract.
const PlatformCapabilitiesSchema = s.strictObject({
  supports_reading_list: v.boolean(),
  supports_background_browser_open: v.boolean(),
  supports_runtime_window_icon_replacement: v.boolean(),
  supports_native_browser_navigation: v.boolean(),
  uses_dev_file_credentials: v.boolean(),
});

function isPlatformKind(kind: string): kind is PlatformKind {
  return PLATFORM_KINDS.some((platformKind) => platformKind === kind);
}

export const PlatformInfoSchema = v.pipe(
  s.strictObject({
    kind: v.string(),
    capabilities: PlatformCapabilitiesSchema,
  }),
  v.transform((platform): PlatformInfo => {
    if (isPlatformKind(platform.kind)) {
      return {
        ...platform,
        kind: platform.kind,
      };
    }

    return DEFAULT_PLATFORM_INFO;
  }),
);

export const MAX_DEV_WINDOW_DIMENSION_PX = 10_000;
const devWindowDimensionSchema = v.nullable(
  v.pipe(v.number(), v.integer(), v.gtValue(0), v.maxValue(MAX_DEV_WINDOW_DIMENSION_PX)),
);

export const DevRuntimeOptionsSchema = s.strictObject({
  dev_intent: v.nullable(v.string()),
  dev_web_url: v.nullable(v.string()),
  dev_window_width: devWindowDimensionSchema,
  dev_window_height: devWindowDimensionSchema,
});

const PlatformPermissionDeniedSurfaceSchema = v.picklist(["file", "dialog", "keyring", "clipboard"]);

export const PlatformPermissionDeniedRecoverySchema = s.strictObject({
  surface: PlatformPermissionDeniedSurfaceSchema,
  user_action_copy: v.pipe(v.string(), v.trim(), v.minLength(1)),
});

export const PlatformPermissionDeniedRecoveryListSchema = v.array(PlatformPermissionDeniedRecoverySchema);

export type DevRuntimeOptions = v.InferOutput<typeof DevRuntimeOptionsSchema>;
export type PlatformPermissionDeniedRecovery = v.InferOutput<typeof PlatformPermissionDeniedRecoverySchema>;
