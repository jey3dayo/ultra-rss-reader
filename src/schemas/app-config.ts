import { z } from "zod";

export const PackageJsonSchema = z.object({
  scripts: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
});

export type PackageJson = z.output<typeof PackageJsonSchema>;

export const TauriUpdaterConfigSchema = z.object({
  plugins: z.object({
    updater: z.object({
      endpoints: z.array(z.string()),
      pubkey: z.string(),
    }),
  }),
});

export const TauriReleaseConfigSchema = z.object({
  identifier: z.string(),
  bundle: z.object({
    createUpdaterArtifacts: z.boolean(),
  }),
});

export const TauriConfigSchema = z.object({
  productName: z.string().optional(),
  identifier: z.string().optional(),
  build: z
    .object({
      beforeDevCommand: z.string().optional(),
      devUrl: z.string().optional(),
      beforeBuildCommand: z.string().optional(),
      frontendDist: z.string().optional(),
    })
    .optional(),
  app: z
    .object({
      windows: z
        .array(
          z.object({
            title: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

export type TauriConfig = z.output<typeof TauriConfigSchema>;

export const TauriCapabilitySchema = z.object({
  permissions: z.array(z.string()),
});

export type TauriCapability = z.output<typeof TauriCapabilitySchema>;
