/** Public TypeScript surface for the memberships client. */

import type { PaginationOptions, PaginationResult } from "convex/server";

/**
 * What a tuple's member points at — an opaque, host-classified string
 * (e.g. `"user"`, `"group"`, `"resource"`, or any host-defined kind).
 */
export type MemberKind = string;

/** A member of a resource, as returned by {@link Memberships.listMembers}. */
export interface MemberEntry {
  memberRef: string;
  memberKind: MemberKind;
  relation: string;
}

/** A resource a member relates to, as returned by {@link Memberships.members}. */
export interface ResourceEntry {
  resourceRef: string;
  relation: string;
}

/** A full membership edge, as returned by {@link Memberships.documents}. */
export interface MembershipDoc {
  memberRef: string;
  memberKind: MemberKind;
  resourceRef: string;
  relation: string;
  /** Opaque host-stamped lifecycle marker, if any. */
  status?: string;
  /** Epoch milliseconds the edge was first inserted. */
  createdAt: number;
}

/** Stable code-tag explaining why a {@link Memberships.setRelation} was rejected. */
export type SetRelationReason = "NOT_FOUND" | "EXISTS";

/** Result of {@link Memberships.setRelation} — may be rejected. */
export interface SetRelationResult {
  ok: boolean;
  /** Stable code-tag when `ok` is false. */
  reason?: SetRelationReason;
}

/** Result of {@link Memberships.remove} — `removed` is true if an edge was deleted. */
export interface RemoveResult {
  removed: boolean;
}

/**
 * A page of results, mirroring Convex's `PaginationResult`. `continueCursor`
 * feeds the next call's `paginationOpts.cursor`; `isDone` is true on the last page.
 */
export type Page<T> = Pick<
  PaginationResult<T>,
  "page" | "isDone" | "continueCursor"
>;

/** Pagination options, as accepted by the paginated client methods. */
export type { PaginationOptions };

/** Construction options for the {@link Memberships} client. */
export interface MembershipsOptions {
  /** Relation applied when a call omits `relation`. Default `"member"`. */
  defaultRelation?: string;
  /** Member kind applied when a call omits `memberKind`. Default `"user"`. */
  defaultMemberKind?: MemberKind;
}
