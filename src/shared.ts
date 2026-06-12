/** Shared constants + types used by both `client/` and `component/`. */

export const COMPONENT_NAME = "memberships";

/**
 * Default relation applied when the host does not name one. A flat ReBAC tuple
 * is `(memberRef, resourceRef, relation)`; this is the relation fallback.
 */
export const DEFAULT_RELATION = "member";

/** Default member kind applied when the host does not classify the member. */
export const DEFAULT_MEMBER_KIND = "user";

/**
 * What a member tuple's `memberRef` points at. An opaque, host-classified
 * string (e.g. `"user"`, `"group"`, `"resource"`, or any host-defined kind) —
 * the component never interprets it.
 */
export type MemberKind = string;

/** Opaque host-supplied member reference. Never assume its shape or source. */
export type MemberRef = string;

/** Opaque host-supplied resource reference. Never assume its shape or source. */
export type ResourceRef = string;
