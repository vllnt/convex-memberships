/**
 * Optional React front-end tooling for `@vllnt/convex-memberships`.
 *
 * Thin, tree-shakeable hooks over `convex/react`'s `useQuery`. Each hook takes
 * the **host app's** re-exported component function reference (the host owns its
 * `api`; this layer never imports it) plus the query args, and returns the
 * query result or `undefined` while it loads.
 *
 * `react` and `convex` are optional peer dependencies — a backend-only consumer
 * pulls none of this. Only metadata derived from the host's own refs reaches the
 * client; the component holds no secrets to leak.
 *
 * @module
 */

import { useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";

/**
 * A reference to the component's `isMember` query, as re-exported by the host
 * (e.g. `api.memberships.isMember`). Resolves whether a member relates to a
 * resource, optionally under a specific relation.
 */
export type IsMemberRef = FunctionReference<
  "query",
  "public",
  { memberRef: string; resourceRef: string; relation?: string },
  boolean
>;

/**
 * A reference to the component's `members` query, as re-exported by the host
 * (e.g. `api.memberships.members`). Returns a page of resources a member
 * relates to.
 */
export type MembersRef = FunctionReference<
  "query",
  "public",
  { memberRef: string; paginationOpts: { numItems: number; cursor: string | null } },
  unknown
>;

/**
 * A reference to the component's `listMembers` query, as re-exported by the host
 * (e.g. `api.memberships.listMembers`). Returns a page of members of a resource,
 * optionally filtered to one relation.
 */
export type ListMembersRef = FunctionReference<
  "query",
  "public",
  {
    resourceRef: string;
    relation?: string;
    paginationOpts: { numItems: number; cursor: string | null };
  },
  unknown
>;

/**
 * Reactively check whether `memberRef` relates to `resourceRef`.
 *
 * @param isMemberRef - the host's re-exported `isMember` query reference.
 * @param args - `memberRef` and `resourceRef`; with `relation`, checks that
 * exact edge, without it checks any relation between the two.
 * @returns `true`/`false`, or `undefined` while the query loads.
 *
 * @example
 * ```tsx
 * const isMember = useIsMember(api.memberships.isMember, {
 *   memberRef: userId,
 *   resourceRef: orgId,
 *   relation: "admin",
 * });
 * ```
 */
export function useIsMember(
  isMemberRef: IsMemberRef,
  args: { memberRef: string; resourceRef: string; relation?: string },
): boolean | undefined {
  return useQuery(isMemberRef, args);
}

/**
 * Reactively list the resources `memberRef` relates to (one page).
 *
 * @param membersRef - the host's re-exported `members` query reference.
 * @param args - `memberRef` to resolve memberships for. Page size and cursor are
 * managed by the host's re-exported query; this hook requests the first page.
 * @returns the resource-entry page, or `undefined` while the query loads.
 *
 * @example
 * ```tsx
 * const page = useMembers(api.memberships.members, { memberRef: userId });
 * ```
 */
export function useMembers(
  membersRef: MembersRef,
  args: { memberRef: string },
): ReturnType<typeof useQuery<MembersRef>> {
  return useQuery(membersRef, {
    memberRef: args.memberRef,
    paginationOpts: { numItems: 100, cursor: null },
  });
}

/**
 * Reactively list the members of `resourceRef` (one page), optionally filtered
 * to a single `relation`.
 *
 * @param listMembersRef - the host's re-exported `listMembers` query reference.
 * @param args - `resourceRef` to resolve members for, and an optional `relation`
 * filter. Page size and cursor are managed by the host's re-exported query; this
 * hook requests the first page.
 * @returns the member-entry page, or `undefined` while the query loads.
 *
 * @example
 * ```tsx
 * const page = useListMembers(api.memberships.listMembers, {
 *   resourceRef: orgId,
 *   relation: "admin",
 * });
 * ```
 */
export function useListMembers(
  listMembersRef: ListMembersRef,
  args: { resourceRef: string; relation?: string },
): ReturnType<typeof useQuery<ListMembersRef>> {
  return useQuery(listMembersRef, {
    resourceRef: args.resourceRef,
    relation: args.relation,
    paginationOpts: { numItems: 100, cursor: null },
  });
}
