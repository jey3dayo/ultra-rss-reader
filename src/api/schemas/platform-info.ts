import { z } from "zod";

export const PlatformCapabilitiesSchema = z.object({
  supports_reading_list: z.boolean(),
  supports_background_browser_open: z.boolean(),
  supports_runtime_window_icon_replacement: z.boolean(),
  supports_native_browser_navigation: z.boolean(),
  uses_dev_file_credentials: z.boolean(),
});

export const PlatformInfoSchema = z.object({
  kind: z.enum(["macos", "windows", "linux", "unknown"]),
  capabilities: PlatformCapabilitiesSchema,
});

export const DevRuntimeOptionsSchema = z.object({
  dev_intent: z.string().nullable(),
  dev_web_url: z.string().nullable(),
  dev_window_width: z.number().int().positive().nullable(),
  dev_window_height: z.number().int().positive().nullable(),
});

export type PlatformCapabilities = z.infer<typeof PlatformCapabilitiesSchema>;
export type PlatformInfo = z.infer<typeof PlatformInfoSchema>;
export type DevRuntimeOptions = z.infer<typeof DevRuntimeOptionsSchema>;
