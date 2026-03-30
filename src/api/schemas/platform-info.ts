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

export type PlatformCapabilities = z.infer<typeof PlatformCapabilitiesSchema>;
export type PlatformInfo = z.infer<typeof PlatformInfoSchema>;
