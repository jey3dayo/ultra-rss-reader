// Bounded edit-distance helper used for preference key typo detection.
export function getEditDistanceWithinLimit(source: string, target: string, limit: number): number {
  if (Math.abs(source.length - target.length) > limit) {
    return limit + 1;
  }

  let previousRow = Array.from({ length: target.length + 1 }, (_value, index) => index);
  for (let sourceIndex = 0; sourceIndex < source.length; sourceIndex += 1) {
    const currentRow = [sourceIndex + 1];
    let rowMinimum = currentRow[0] ?? limit + 1;
    for (let targetIndex = 0; targetIndex < target.length; targetIndex += 1) {
      const substitutionCost = source[sourceIndex] === target[targetIndex] ? 0 : 1;
      const insertionCost = (currentRow[targetIndex] ?? limit + 1) + 1;
      const deletionCost = (previousRow[targetIndex + 1] ?? limit + 1) + 1;
      const substitution = (previousRow[targetIndex] ?? limit + 1) + substitutionCost;
      const distance = Math.min(insertionCost, deletionCost, substitution);
      currentRow.push(distance);
      rowMinimum = Math.min(rowMinimum, distance);
    }

    if (rowMinimum > limit) {
      return limit + 1;
    }
    previousRow = currentRow;
  }

  return previousRow[target.length] ?? limit + 1;
}
