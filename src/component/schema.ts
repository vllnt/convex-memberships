import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Sandboxed table — the relationship graph's own concern. A row is one flat
 * ReBAC edge `(memberRef, resourceRef, relation)`. `memberRef`, `resourceRef`,
 * `relation`, and `memberKind` are opaque host strings (never assume their
 * shape). `status` is an opaque, optional lifecycle marker the host may stamp
 * (e.g. `"active"`, `"invited"`); the component never inspects it. FLAT edges
 * only — no transitive expansion in this version.
 */
export default defineSchema({
  memberships: defineTable({
    memberRef: v.string(),
    memberKind: v.string(),
    resourceRef: v.string(),
    relation: v.string(),
    status: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_member", ["memberRef"])
    .index("by_resource", ["resourceRef"])
    .index("by_resource_relation", ["resourceRef", "relation"])
    .index("by_member_resource", ["memberRef", "resourceRef"])
    .index("by_tuple", ["memberRef", "resourceRef", "relation"]),
});
