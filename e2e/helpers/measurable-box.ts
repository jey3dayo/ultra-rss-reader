import { expect, type Locator } from "@playwright/test";

type MeasurableBox = NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>;

export async function expectMeasurableBox(locator: Locator, message: string): Promise<MeasurableBox> {
  const box = await locator.boundingBox();

  expect(box, message).not.toBeNull();

  if (box === null) {
    throw new Error(message);
  }

  return box;
}
