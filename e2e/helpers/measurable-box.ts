import { expect, type Locator } from "@playwright/test";

type MeasurableBox = NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>;

function measurableBoxFailureMessage(locator: Locator, targetName: string, box?: MeasurableBox): string {
  const viewport = locator.page().viewportSize();
  const viewportLabel = viewport === null ? "unknown" : `${viewport.width}x${viewport.height}`;
  const lines = [
    `Expected ${targetName} to have a measurable bounding box.`,
    `Locator: ${locator.toString()}`,
    `Viewport: ${viewportLabel}`,
  ];

  if (box !== undefined) {
    lines.push(`Box: x=${box.x}, y=${box.y}, width=${box.width}, height=${box.height}`);
  }

  return lines.join("\n");
}

export async function expectMeasurableBox(locator: Locator, targetName: string): Promise<MeasurableBox> {
  const message = measurableBoxFailureMessage(locator, targetName);
  const box = await locator.boundingBox();

  expect(box, message).not.toBeNull();

  if (box === null) {
    throw new Error(message);
  }

  const boxMessage = measurableBoxFailureMessage(locator, targetName, box);
  expect(box.width, boxMessage).toBeGreaterThan(0);
  expect(box.height, boxMessage).toBeGreaterThan(0);

  return box;
}
