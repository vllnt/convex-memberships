import { ConvexError } from "convex/values";

/**
 * Reject empty host-supplied strings on write paths. Reactive queries never call
 * this: UIs may pass placeholder values (e.g. `""`) while an id is still loading,
 * and a read of an unknown tuple simply finds nothing.
 */
export function requireNonEmpty(fields: Record<string, string | undefined>): void {
  for (const [name, value] of Object.entries(fields)) {
    if (value === "") {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: `${name} must not be empty`,
      });
    }
  }
}

export const MAX_REF_LENGTH = 512;

export function requireMaxLength(fields: Record<string, string | undefined>): void {
  for (const [name, value] of Object.entries(fields)) {
    if (value !== undefined && value.length > MAX_REF_LENGTH) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: `${name} must be at most ${MAX_REF_LENGTH} characters`,
      });
    }
  }
}
