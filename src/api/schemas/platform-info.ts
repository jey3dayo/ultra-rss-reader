import { z } from "zod";
import { DEFAULT_PLATFORM_INFO, PLATFORM_KINDS, type PlatformInfoShape, type PlatformKind } from "@/constants/platform";

export type PlatformInfo = PlatformInfoShape;

// Capabilities are part of PlatformInfo; keep the nested schema local until callers need a standalone contract.
const PlatformCapabilitiesSchema = z.strictObject({
  supports_reading_list: z.boolean(),
  supports_background_browser_open: z.boolean(),
  supports_runtime_window_icon_replacement: z.boolean(),
  supports_native_browser_navigation: z.boolean(),
  uses_dev_file_credentials: z.boolean(),
});

function isPlatformKind(kind: string): kind is PlatformKind {
  return PLATFORM_KINDS.some((platformKind) => platformKind === kind);
}

export const PlatformInfoSchema: z.ZodType<PlatformInfo> = z
  .strictObject({
    kind: z.string(),
    capabilities: PlatformCapabilitiesSchema,
  })
  .transform((platform): PlatformInfo => {
    if (isPlatformKind(platform.kind)) {
      return {
        ...platform,
        kind: platform.kind,
      };
    }

    return DEFAULT_PLATFORM_INFO;
  });

export const MAX_DEV_WINDOW_DIMENSION_PX = 10_000;
const devWindowDimensionSchema = z.number().int().positive().max(MAX_DEV_WINDOW_DIMENSION_PX).nullable();

export const DevRuntimeOptionsSchema = z.strictObject({
  dev_intent: z.string().nullable(),
  dev_web_url: z.string().nullable(),
  dev_window_width: devWindowDimensionSchema,
  dev_window_height: devWindowDimensionSchema,
});

const PlatformPermissionDeniedSurfaceSchema = z.enum(["file", "dialog", "keyring", "clipboard"]);

export const PlatformPermissionDeniedRecoverySchema = z.strictObject({
  surface: PlatformPermissionDeniedSurfaceSchema,
  user_action_copy: z.string().trim().min(1),
});

export const PlatformPermissionDeniedRecoveryListSchema = z.array(PlatformPermissionDeniedRecoverySchema);

export type DevRuntimeOptions = z.output<typeof DevRuntimeOptionsSchema>;
export type PlatformPermissionDeniedRecovery = z.output<typeof PlatformPermissionDeniedRecoverySchema>;
