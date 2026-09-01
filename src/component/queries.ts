import { paginationOptsValidator } from "convex/server";
import type { PaginationOptions } from "convex/server";
import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import {
  memberEntry,
  memberEntryPage,
  membershipDocPage,
  resourceEntry,
  resourceEntryPage,
} from "./validators";

const MAX_PAGE_SIZE = 1000;

function boundedPaginationOptions(
  paginationOpts: PaginationOptions,
): PaginationOptions {
  const { numItems, maximumRowsRead } = paginationOpts;
  if (
    !Number.isFinite(numItems) ||
    !Number.isInteger(numItems) ||
    numItems < 1 ||
    numItems > MAX_PAGE_SIZE
  ) {
    throw new ConvexError({
      code: "INVALID_PAGE_SIZE",
      message: `paginationOpts.numItems must be an integer between 1 and ${MAX_PAGE_SIZE}`,
    });
  }
  if (
    maximumRowsRead !== undefined &&
    (!Number.isFinite(maximumRowsRead) ||
      !Number.isInteger(maximumRowsRead) ||
      maximumRowsRead < 1)
  ) {
    throw new ConvexError({
      code: "INVALID_PAGE_SIZE",
      message: "paginationOpts.maximumRowsRead must be a positive finite integer",
    });
  }
  return {
    ...paginationOpts,
    maximumRowsRead: Math.min(maximumRowsRead ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}

export const listMembers = query({
  args: {
    resourceRef: v.string(),
    relation: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: memberEntryPage,
  handler: async (ctx, args) => {
    const paginationOpts = boundedPaginationOptions(args.paginationOpts);
    const relation = args.relation;
    const result =
      relation === undefined
        ? await ctx.db
            .query("memberships")
            .withIndex("by_resource", (q) =>
              q.eq("resourceRef", args.resourceRef),
            )
            .paginate(paginationOpts)
        : await ctx.db
            .query("memberships")
            .withIndex("by_resource_relation", (q) =>
              q.eq("resourceRef", args.resourceRef).eq("relation", relation),
            )
            .paginate(paginationOpts);
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
    const paginationOpts = boundedPaginationOptions(args.paginationOpts);
    const result = await ctx.db
      .query("memberships")
      .withIndex("by_member", (q) => q.eq("memberRef", args.memberRef))
      .paginate(paginationOpts);
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
    const paginationOpts = boundedPaginationOptions(args.paginationOpts);
    const resourceRef = args.resourceRef;
    const memberRef = args.memberRef;
    const result =
      resourceRef !== undefined
        ? await ctx.db
            .query("memberships")
            .withIndex("by_resource", (q) => q.eq("resourceRef", resourceRef))
            .paginate(paginationOpts)
        : memberRef !== undefined
          ? await ctx.db
              .query("memberships")
              .withIndex("by_member", (q) => q.eq("memberRef", memberRef))
              .paginate(paginationOpts)
          : await ctx.db.query("memberships").paginate(paginationOpts);
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
