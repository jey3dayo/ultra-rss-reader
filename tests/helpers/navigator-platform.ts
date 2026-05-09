type NavigatorPlatformStubOptions = {
  platform?: string;
  userAgentDataPlatform?: string;
};

const MISSING_PROPERTY = Symbol("missing navigator property");

function restoreNavigatorProperty(
  property: "platform" | "userAgentData",
  descriptor: PropertyDescriptor | typeof MISSING_PROPERTY,
) {
  if (descriptor === MISSING_PROPERTY) {
    Reflect.deleteProperty(window.navigator, property);
    return;
  }

  Object.defineProperty(window.navigator, property, descriptor);
}

export function stubNavigatorPlatform({ platform, userAgentDataPlatform }: NavigatorPlatformStubOptions): () => void {
  const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(window.navigator, "platform") ?? MISSING_PROPERTY;
  const originalUserAgentDataDescriptor =
    Object.getOwnPropertyDescriptor(window.navigator, "userAgentData") ?? MISSING_PROPERTY;

  if (platform !== undefined) {
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: platform,
    });
  }

  if (userAgentDataPlatform !== undefined) {
    Object.defineProperty(window.navigator, "userAgentData", {
      configurable: true,
      get: () => ({ platform: userAgentDataPlatform }),
    });
  }

  return () => {
    try {
      restoreNavigatorProperty("platform", originalPlatformDescriptor);
      restoreNavigatorProperty("userAgentData", originalUserAgentDataDescriptor);
    } catch (error) {
      const causeMessage = error instanceof Error ? ` ${error.message}` : "";
      throw new Error(`Failed to restore navigator platform stub.${causeMessage}`);
    }
  };
}
