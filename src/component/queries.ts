import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import {
  memberEntry,
  memberEntryPage,
  membershipDocPage,
  resourceEntry,
  resourceEntryPage,
} from "./validators";

export const listMembers = query({
  args: {
    resourceRef: v.string(),
    relation: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: memberEntryPage,
  handler: async (ctx, args) => {
    const relation = args.relation;
    const result =
      relation === undefined
        ? await ctx.db
            .query("memberships")
            .withIndex("by_resource", (q) =>
              q.eq("resourceRef", args.resourceRef),
            )
            .paginate(args.paginationOpts)
        : await ctx.db
            .query("memberships")
            .withIndex("by_resource_relation", (q) =>
              q.eq("resourceRef", args.resourceRef).eq("relation", relation),
            )
            .paginate(args.paginationOpts);
    return {
      page: result.page.map((row) => ({
        memberRef: row.memberRef,
        memberKind: row.memberKind,
        relation: row.relation,
      })),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

export const members = query({
  args: { memberRef: v.string(), paginationOpts: paginationOptsValidator },
  returns: resourceEntryPage,
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("memberships")
      .withIndex("by_member", (q) => q.eq("memberRef", args.memberRef))
      .paginate(args.paginationOpts);
    return {
      page: result.page.map((row) => ({
        resourceRef: row.resourceRef,
        relation: row.relation,
      })),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

/**
 * Whether `memberRef` relates to `resourceRef` under the given `relation`, or
 * under **any** stored relation when `relation` is omitted.
 *
 * @remarks
 * **Security warning — unscoped path.** When `relation` is omitted this
 * function returns `true` for **any** relation stored between the pair
 * (e.g. `"invited"`, `"suspended"`, `"banned"`). Do **not** use the
 * unscoped path as an authorization gate without first enumerating every
 * relation your policy considers sufficient for the guarded action. Use the
 * scoped path (`relation` provided) for authz checks, or enumerate
 * acceptable relations explicitly before calling.
 */
export const isMember = query({
  args: {
    memberRef: v.string(),
    resourceRef: v.string(),
    relation: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const relation = args.relation;
    if (relation !== undefined) {
      const row = await ctx.db
        .query("memberships")
        .withIndex("by_tuple", (q) =>
          q
            .eq("memberRef", args.memberRef)
            .eq("resourceRef", args.resourceRef)
            .eq("relation", relation),
        )
        .first();
      return row !== null;
    }
    const row = await ctx.db
      .query("memberships")
      .withIndex("by_member_resource", (q) =>
        q.eq("memberRef", args.memberRef).eq("resourceRef", args.resourceRef),
      )
      .first();
    return row !== null;
  },
});

export const documents = query({
  args: {
    resourceRef: v.optional(v.string()),
    memberRef: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: membershipDocPage,
  handler: async (ctx, args) => {
    const resourceRef = args.resourceRef;
    const memberRef = args.memberRef;
    const result =
      resourceRef !== undefined
        ? await ctx.db
            .query("memberships")
            .withIndex("by_resource", (q) => q.eq("resourceRef", resourceRef))
            .paginate(args.paginationOpts)
        : memberRef !== undefined
          ? await ctx.db
              .query("memberships")
              .withIndex("by_member", (q) => q.eq("memberRef", memberRef))
              .paginate(args.paginationOpts)
          : await ctx.db.query("memberships").paginate(args.paginationOpts);
    return {
      page: result.page.map((row) => ({
        memberRef: row.memberRef,
        memberKind: row.memberKind,
        resourceRef: row.resourceRef,
        relation: row.relation,
        status: row.status,
        createdAt: row.createdAt,
      })),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});
