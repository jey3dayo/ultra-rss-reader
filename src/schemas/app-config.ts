import { z } from "zod";

export const PackageJsonSchema = z.object({
  version: z.string().optional(),
  packageManager: z.string().optional(),
  private: z.boolean().optional(),
  type: z.string().optional(),
  engines: z.record(z.string(), z.string()).optional(),
  scripts: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  knip: z
    .object({
      ignoreDependencies: z.array(z.string()).optional(),
    })
    .optional(),
});

export type PackageJson = z.output<typeof PackageJsonSchema>;

export const TauriUpdaterConfigSchema = z.object({
  bundle: z
    .object({
      createUpdaterArtifacts: z.boolean(),
    })
    .optional(),
  plugins: z.object({
    updater: z.object({
      endpoints: z.array(z.string()),
      pubkey: z.string(),
    }),
  }),
});

export type TauriUpdaterConfig = z.output<typeof TauriUpdaterConfigSchema>;

export const TauriReleaseConfigSchema = z.object({
  identifier: z.string(),
  bundle: z.object({
    createUpdaterArtifacts: z.boolean(),
  }),
});

export type TauriReleaseConfig = z.output<typeof TauriReleaseConfigSchema>;

export const TauriConfigSchema = z.object({
  $schema: z.string().optional(),
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
