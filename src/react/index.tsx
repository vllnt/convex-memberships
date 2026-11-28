/**
 * Optional React front-end tooling for `@vllnt/convex-memberships`.
 *
 * Thin, tree-shakeable hooks over `convex/react`'s `useQuery`. Each hook takes
 * a reference to a **host** query (the host owns its `api`; this layer never
 * imports it) plus the query args, and returns the query result or `undefined`
 * while it loads. That host query must wrap the component and authorize the
 * caller: the hook sends its args from the client, so a plain re-export of a
 * component query would let any client read any member's or resource's edges.
 *
 * `react` is an optional peer dependency — a backend-only consumer never
 * imports this entry.
 *
 * @module
 */

import { useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import type { MemberEntry, Page, ResourceEntry } from "../client/types.js";

/**
 * A reference to the host's own `isMember` query (e.g. `api.memberships.isMember`):
 * a host function that authorizes the caller, then calls the component. Resolves whether a member relates to a
 * resource, optionally under a specific relation.
 */
export type IsMemberRef = FunctionReference<
  "query",
  "public",
  { memberRef: string; resourceRef: string; relation?: string },
  boolean
>;

/**
 * A reference to the host's own `members` query (e.g. `api.memberships.members`):
 * a host function that authorizes the caller, then calls the component. Returns a page of resources a member
 * relates to.
 */
export type MembersRef = FunctionReference<
  "query",
  "public",
  {
    memberRef: string;
    paginationOpts: { numItems: number; cursor: string | null };
  },
  Page<ResourceEntry>
>;

/**
 * A reference to the host's own `listMembers` query (e.g. `api.memberships.listMembers`):
 * a host function that authorizes the caller, then calls the component. Returns a page of members of a resource,
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
  Page<MemberEntry>
>;

/**
 * Reactively check whether `memberRef` relates to `resourceRef`.
 *
 * @param isMemberRef - the host's authorizing `isMember` query reference.
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
 * @param membersRef - the host's authorizing `members` query reference.
 * @param args - `memberRef` to resolve memberships for. The hook always requests
 * the first page (`{ numItems: 100, cursor: null }`) and offers no load-more.
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
 * @param listMembersRef - the host's authorizing `listMembers` query reference.
 * @param args - `resourceRef` to resolve members for, and an optional `relation`
 * filter. The hook always requests the first page
 * (`{ numItems: 100, cursor: null }`) and offers no load-more.
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
