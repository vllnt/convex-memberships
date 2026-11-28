import { convexTest } from "convex-test";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import { register } from "../../src/test";

// Regression: `register(t)` must accept a `convex-test` instance built from a
// host schema with its own tables. 0.1.0 typed `t` to the component's schema,
// so this file failed to type-check. `pnpm typecheck:ci` (tsconfig.ci.json)
// type-checks it in CI; `pnpm test` runs it.
const hostSchema = defineSchema({
  users: defineTable({ name: v.string() }),
});

test("register(t) mounts the component next to host tables", async () => {
  const t = convexTest(hostSchema, import.meta.glob("./**/*.ts"));
  register(t);

  const edge = {
    memberRef: "user_1",
    resourceRef: "org_1",
    relation: "member",
  };
  await t.mutation(api.example.add, edge);
  expect(await t.query(api.example.isMember, edge)).toBe(true);

  const userId = await t.run((ctx) => ctx.db.insert("users", { name: "Ada" }));
  const user = await t.run((ctx) => ctx.db.get("users", userId));
  expect(user?.name).toBe("Ada");
});
