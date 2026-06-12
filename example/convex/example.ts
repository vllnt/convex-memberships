import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { Memberships } from "../../src/client";

/**
 * Host-app wrappers. The host owns auth + identity: resolve them here, then pass
 * opaque `memberRef` / `resourceRef` strings into the memberships client.
 */
const memberships = new Memberships(components.memberships);

/** A second client with non-default options — exercises the option branches. */
const groupMemberships = new Memberships(components.memberships, {
  defaultRelation: "owner",
  defaultMemberKind: "group",
});

const memberEntry = v.object({
  memberRef: v.string(),
  memberKind: v.string(),
  relation: v.string(),
});
const resourceEntry = v.object({
  resourceRef: v.string(),
  relation: v.string(),
});
const membershipDoc = v.object({
  memberRef: v.string(),
  memberKind: v.string(),
  resourceRef: v.string(),
  relation: v.string(),
  status: v.optional(v.string()),
  createdAt: v.number(),
});
const setRelationResult = v.object({
  ok: v.boolean(),
  reason: v.optional(v.union(v.literal("NOT_FOUND"), v.literal("EXISTS"))),
});
const removeResult = v.object({ removed: v.boolean() });
const memberEntryPage = v.object({
  page: v.array(memberEntry),
  isDone: v.boolean(),
  continueCursor: v.string(),
});
const resourceEntryPage = v.object({
  page: v.array(resourceEntry),
  isDone: v.boolean(),
  continueCursor: v.string(),
});
const membershipDocPage = v.object({
  page: v.array(membershipDoc),
  isDone: v.boolean(),
  continueCursor: v.string(),
});

export const add = mutation({
  args: {
    memberRef: v.string(),
    resourceRef: v.string(),
    relation: v.optional(v.string()),
    memberKind: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  returns: v.string(),
  handler: (ctx, a) =>
    memberships.add(
      ctx,
      a.memberRef,
      a.resourceRef,
      a.relation,
      a.memberKind,
      a.status,
    ),
});

export const remove = mutation({
  args: {
    memberRef: v.string(),
    resourceRef: v.string(),
    relation: v.optional(v.string()),
  },
  returns: removeResult,
  handler: (ctx, a) =>
    memberships.remove(ctx, a.memberRef, a.resourceRef, a.relation),
});

export const setRelation = mutation({
  args: {
    memberRef: v.string(),
    resourceRef: v.string(),
    fromRelation: v.string(),
    toRelation: v.string(),
  },
  returns: setRelationResult,
  handler: (ctx, a) =>
    memberships.setRelation(
      ctx,
      a.memberRef,
      a.resourceRef,
      a.fromRelation,
      a.toRelation,
    ),
});

export const listMembers = query({
  args: {
    resourceRef: v.string(),
    relation: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: memberEntryPage,
  handler: (ctx, a) =>
    memberships.listMembers(ctx, a.resourceRef, a.paginationOpts, a.relation),
});

export const members = query({
  args: { memberRef: v.string(), paginationOpts: paginationOptsValidator },
  returns: resourceEntryPage,
  handler: (ctx, a) => memberships.members(ctx, a.memberRef, a.paginationOpts),
});

export const isMember = query({
  args: {
    memberRef: v.string(),
    resourceRef: v.string(),
    relation: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: (ctx, a) =>
    memberships.isMember(ctx, a.memberRef, a.resourceRef, a.relation),
});

export const documents = query({
  args: {
    resourceRef: v.optional(v.string()),
    memberRef: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: membershipDocPage,
  handler: (ctx, a) =>
    memberships.documents(ctx, a.paginationOpts, {
      resourceRef: a.resourceRef,
      memberRef: a.memberRef,
    }),
});

/** Default-relation, group-kind variant — exercises the client's option branches. */
export const addDefault = mutation({
  args: { memberRef: v.string(), resourceRef: v.string() },
  returns: v.string(),
  handler: (ctx, a) => groupMemberships.add(ctx, a.memberRef, a.resourceRef),
});

export const listOwners = query({
  args: { resourceRef: v.string(), paginationOpts: paginationOptsValidator },
  returns: memberEntryPage,
  handler: (ctx, a) =>
    groupMemberships.listMembers(ctx, a.resourceRef, a.paginationOpts, "owner"),
});
