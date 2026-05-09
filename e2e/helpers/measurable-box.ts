import { expect, type Locator } from "@playwright/test";

type MeasurableBox = NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>;

export async function expectMeasurableBox(locator: Locator, targetName: string): Promise<MeasurableBox> {
  const message = `Expected ${targetName} to have a measurable bounding box.`;
  const box = await locator.boundingBox();

  expect(box, message).not.toBeNull();

  if (box === null) {
    throw new Error(message);
  }

  return box;
}
