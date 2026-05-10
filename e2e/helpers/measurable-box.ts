import { expect, type Locator } from "@playwright/test";

type MeasurableBox = NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>;

function measurableBoxFailureMessage(locator: Locator, targetName: string): string {
  const viewport = locator.page().viewportSize();
  const viewportLabel = viewport === null ? "unknown" : `${viewport.width}x${viewport.height}`;

  return [
    `Expected ${targetName} to have a measurable bounding box.`,
    `Locator: ${locator.toString()}`,
    `Viewport: ${viewportLabel}`,
  ].join("\n");
}

export async function expectMeasurableBox(locator: Locator, targetName: string): Promise<MeasurableBox> {
  const message = measurableBoxFailureMessage(locator, targetName);
  const box = await locator.boundingBox();

  expect(box, message).not.toBeNull();

  if (box === null) {
    throw new Error(message);
  }

  expect(box.width, message).toBeGreaterThan(0);
  expect(box.height, message).toBeGreaterThan(0);

  return box;
}
