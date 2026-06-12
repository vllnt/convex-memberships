import { v } from "convex/values";

/**
 * What a tuple's `memberRef` points at — an opaque, host-classified string
 * (e.g. `"user"`, `"group"`, `"resource"`, or any host-defined kind). The
 * component never interprets it. Defaults to `"user"` when the host omits it.
 */
export const memberKind = v.string();

/** A full membership edge as stored — returned by document-shaped queries. */
export const membershipDoc = v.object({
  memberRef: v.string(),
  memberKind,
  resourceRef: v.string(),
  relation: v.string(),
  status: v.optional(v.string()),
  createdAt: v.number(),
});

/** Projection returned by `listMembers` — who relates to a resource, and how. */
export const memberEntry = v.object({
  memberRef: v.string(),
  memberKind,
  relation: v.string(),
});

/** Projection returned by `members` — which resources a member relates to, and how. */
export const resourceEntry = v.object({
  resourceRef: v.string(),
  relation: v.string(),
});

/** A stable code-tag explaining why a `setRelation` was rejected. */
export const setRelationReason = v.union(
  v.literal("NOT_FOUND"),
  v.literal("EXISTS"),
);

/**
 * Result of `setRelation`. `reason` carries a stable code-tag (`NOT_FOUND`,
 * `EXISTS`) when `ok` is false.
 */
export const setRelationResult = v.object({
  ok: v.boolean(),
  reason: v.optional(setRelationReason),
});

/** Result of `remove` — `removed` is true when an edge was actually deleted. */
export const removeResult = v.object({
  removed: v.boolean(),
});

/** A page of `MemberEntry` rows, as returned by a paginated `listMembers`. */
export const memberEntryPage = v.object({
  page: v.array(memberEntry),
  isDone: v.boolean(),
  continueCursor: v.string(),
});

/** A page of `ResourceEntry` rows, as returned by a paginated `members`. */
export const resourceEntryPage = v.object({
  page: v.array(resourceEntry),
  isDone: v.boolean(),
  continueCursor: v.string(),
});

/** A page of full membership docs, as returned by the paginated `documents`. */
export const membershipDocPage = v.object({
  page: v.array(membershipDoc),
  isDone: v.boolean(),
  continueCursor: v.string(),
});
