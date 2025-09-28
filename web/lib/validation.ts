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

export function assert<T>(condition: T, message?: string): asserts condition {
  if (!condition) {
    throw new Error(
      message || `Assertion failed: expected truthy value, got ${condition}`
    );
  }
}
