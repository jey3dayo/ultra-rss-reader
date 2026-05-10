export async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
}

export async function flushMacrotask(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

export async function flushRaf(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
}

export async function flushMicrotasksAndRealTimer(): Promise<void> {
  await flushMicrotasks();
  await flushMacrotask();
}
