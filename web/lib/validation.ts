export function assertNotNullable<T>(
  value: T | null | undefined,
  message?: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(
      message || `Expected value to not be null or undefined, but got ${value}`
    );
  }
}
