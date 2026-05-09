const DATA_ATTRIBUTE_NAME_PATTERN = /^data-[a-z0-9_-]+$/;

export function queryElementByDataAttribute<T extends Element>(
  root: ParentNode,
  attributeName: string,
  value: string,
): T | null {
  if (!DATA_ATTRIBUTE_NAME_PATTERN.test(attributeName)) {
    return null;
  }

  for (const element of root.querySelectorAll<T>(`[${attributeName}]`)) {
    if (element.getAttribute(attributeName) === value) {
      return element;
    }
  }

  return null;
}
