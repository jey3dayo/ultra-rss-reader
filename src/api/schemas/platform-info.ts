import { z } from "zod";
import { PLATFORM_KINDS } from "@/constants/platform";

// Capabilities are part of PlatformInfo; keep the nested schema local until callers need a standalone contract.
const PlatformCapabilitiesSchema = z.object({
  supports_reading_list: z.boolean(),
  supports_background_browser_open: z.boolean(),
  supports_runtime_window_icon_replacement: z.boolean(),
  supports_native_browser_navigation: z.boolean(),
  uses_dev_file_credentials: z.boolean(),
});

export const PlatformInfoSchema = z.object({
  kind: z.enum(PLATFORM_KINDS),
  capabilities: PlatformCapabilitiesSchema,
});

export const MAX_DEV_WINDOW_DIMENSION_PX = 10_000;
const devWindowDimensionSchema = z.number().int().positive().max(MAX_DEV_WINDOW_DIMENSION_PX).nullable();

export const DevRuntimeOptionsSchema = z.object({
  dev_intent: z.string().nullable(),
  dev_web_url: z.string().nullable(),
  dev_window_width: devWindowDimensionSchema,
  dev_window_height: devWindowDimensionSchema,
});

export type PlatformInfo = z.output<typeof PlatformInfoSchema>;
export type DevRuntimeOptions = z.output<typeof DevRuntimeOptionsSchema>;
