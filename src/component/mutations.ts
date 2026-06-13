import type { Infer } from "convex/values";
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { memberKind, removeResult, setRelationResult } from "./validators";

type SetRelationResult = Infer<typeof setRelationResult>;

export const add = mutation({
  args: {
    memberRef: v.string(),
    memberKind,
    resourceRef: v.string(),
    relation: v.string(),
    status: v.optional(v.string()),
  },
  returns: v.id("memberships"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_tuple", (q) =>
        q
          .eq("memberRef", args.memberRef)
          .eq("resourceRef", args.resourceRef)
          .eq("relation", args.relation),
      )
      .first();
    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        memberKind: args.memberKind,
        status: args.status,
      });
      return existing._id;
    }
    return await ctx.db.insert("memberships", {
      memberRef: args.memberRef,
      memberKind: args.memberKind,
      resourceRef: args.resourceRef,
      relation: args.relation,
      status: args.status,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: {
    memberRef: v.string(),
    resourceRef: v.string(),
    relation: v.string(),
  },
  returns: removeResult,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_tuple", (q) =>
        q
          .eq("memberRef", args.memberRef)
          .eq("resourceRef", args.resourceRef)
          .eq("relation", args.relation),
      )
      .first();
    if (existing === null) {
      return { removed: false };
    }
    await ctx.db.delete(existing._id);
    return { removed: true };
  },
});

export const setRelation = mutation({
  args: {
    memberRef: v.string(),
    resourceRef: v.string(),
    fromRelation: v.string(),
    toRelation: v.string(),
  },
  returns: setRelationResult,
  handler: async (ctx, args): Promise<SetRelationResult> => {
    const from = await ctx.db
      .query("memberships")
      .withIndex("by_tuple", (q) =>
        q
          .eq("memberRef", args.memberRef)
          .eq("resourceRef", args.resourceRef)
          .eq("relation", args.fromRelation),
      )
      .first();
    if (from === null) {
      return { ok: false, reason: "NOT_FOUND" };
    }
    if (args.fromRelation === args.toRelation) {
      return { ok: true };
    }
    const taken = await ctx.db
      .query("memberships")
      .withIndex("by_tuple", (q) =>
        q
          .eq("memberRef", args.memberRef)
          .eq("resourceRef", args.resourceRef)
          .eq("relation", args.toRelation),
      )
      .first();
    if (taken !== null) {
      return { ok: false, reason: "EXISTS" };
    }
    await ctx.db.patch(from._id, { relation: args.toRelation });
    return { ok: true };
  },
});
