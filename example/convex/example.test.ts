import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { register } from "../../src/test";

const modules = import.meta.glob("./**/*.ts");

const PAGE = { numItems: 50, cursor: null };

function setup() {
  const t = convexTest(schema, modules);
  register(t);
  return t;
}

describe("memberships — add", () => {
  test("add a new edge then read it back (happy path)", async () => {
    const t = setup();
    const id = await t.mutation(api.example.add, {
      memberRef: "user_1",
      resourceRef: "org_1",
      relation: "member",
    });
    expect(typeof id).toBe("string");
    expect(
      await t.query(api.example.isMember, {
        memberRef: "user_1",
        resourceRef: "org_1",
        relation: "member",
      }),
    ).toBe(true);
  });

  test("adding a duplicate tuple is idempotent — same id, no second row", async () => {
    const t = setup();
    const a = await t.mutation(api.example.add, {
      memberRef: "user_1",
      resourceRef: "org_1",
      relation: "member",
    });
    const b = await t.mutation(api.example.add, {
      memberRef: "user_1",
      resourceRef: "org_1",
      relation: "member",
    });
    expect(b).toBe(a);
    const list = await t.query(api.example.listMembers, {
      resourceRef: "org_1",
      paginationOpts: PAGE,
    });
    expect(list.page).toHaveLength(1);
  });

  test("concurrent identical adds yield exactly one row", async () => {
    const t = setup();
    const args = {
      memberRef: "user_1",
      resourceRef: "org_1",
      relation: "member",
    };
    const ids = await Promise.all([
      t.mutation(api.example.add, args),
      t.mutation(api.example.add, args),
      t.mutation(api.example.add, args),
    ]);
    expect(new Set(ids).size).toBe(1);
    const list = await t.query(api.example.listMembers, {
      resourceRef: "org_1",
      paginationOpts: PAGE,
    });
    expect(list.page).toHaveLength(1);
  });

  test("add classifies the member kind", async () => {
    const t = setup();
    await t.mutation(api.example.add, {
      memberRef: "group_1",
      resourceRef: "org_1",
      relation: "member",
      memberKind: "group",
    });
    const list = await t.query(api.example.listMembers, {
      resourceRef: "org_1",
      paginationOpts: PAGE,
    });
    expect(list.page).toEqual([
      { memberRef: "group_1", memberKind: "group", relation: "member" },
    ]);
  });

  test("add accepts an arbitrary opaque memberKind (no closed union)", async () => {
    const t = setup();
    await t.mutation(api.example.add, {
      memberRef: "svc_1",
      resourceRef: "org_1",
      relation: "member",
      memberKind: "service-account",
    });
    const docs = await t.query(api.example.documents, {
      resourceRef: "org_1",
      paginationOpts: PAGE,
    });
    expect(docs.page[0].memberKind).toBe("service-account");
  });

  test("add stamps an opaque status and exposes it via documents", async () => {
    const t = setup();
    await t.mutation(api.example.add, {
      memberRef: "user_1",
      resourceRef: "org_1",
      relation: "member",
      status: "invited",
    });
    const docs = await t.query(api.example.documents, {
      resourceRef: "org_1",
      paginationOpts: PAGE,
    });
    expect(docs.page[0].status).toBe("invited");
    expect(typeof docs.page[0].createdAt).toBe("number");
  });
});

describe("memberships — remove", () => {
  test("remove an existing edge clears it and reports removed", async () => {
    const t = setup();
    await t.mutation(api.example.add, {
      memberRef: "user_1",
      resourceRef: "org_1",
      relation: "member",
    });
    expect(
      await t.mutation(api.example.remove, {
        memberRef: "user_1",
        resourceRef: "org_1",
        relation: "member",
      }),
    ).toEqual({ removed: true });
    expect(
      await t.query(api.example.isMember, {
        memberRef: "user_1",
        resourceRef: "org_1",
        relation: "member",
      }),
    ).toBe(false);
  });

  test("removing a missing edge is an idempotent no-op (removed: false)", async () => {
    const t = setup();
    expect(
      await t.mutation(api.example.remove, {
        memberRef: "ghost",
        resourceRef: "org_1",
        relation: "member",
      }),
    ).toEqual({ removed: false });
  });
});

describe("memberships — setRelation", () => {
  test("setRelation moves the edge to the new relation (ok)", async () => {
    const t = setup();
    await t.mutation(api.example.add, {
      memberRef: "user_1",
      resourceRef: "org_1",
      relation: "member",
    });
    const r = await t.mutation(api.example.setRelation, {
      memberRef: "user_1",
      resourceRef: "org_1",
      fromRelation: "member",
      toRelation: "admin",
    });
    expect(r).toEqual({ ok: true });
    expect(
      await t.query(api.example.isMember, {
        memberRef: "user_1",
        resourceRef: "org_1",
        relation: "admin",
      }),
    ).toBe(true);
    expect(
      await t.query(api.example.isMember, {
        memberRef: "user_1",
        resourceRef: "org_1",
        relation: "member",
      }),
    ).toBe(false);
  });

  test("setRelation leaves exactly one tuple — no stale row", async () => {
    const t = setup();
    await t.mutation(api.example.add, {
      memberRef: "user_1",
      resourceRef: "org_1",
      relation: "member",
    });
    await t.mutation(api.example.setRelation, {
      memberRef: "user_1",
      resourceRef: "org_1",
      fromRelation: "member",
      toRelation: "admin",
    });
    const list = await t.query(api.example.listMembers, {
      resourceRef: "org_1",
      paginationOpts: PAGE,
    });
    expect(list.page).toHaveLength(1);
    expect(list.page[0].relation).toBe("admin");
  });

  test("setRelation where from === to is a no-op ok (no false EXISTS)", async () => {
    const t = setup();
    await t.mutation(api.example.add, {
      memberRef: "user_1",
      resourceRef: "org_1",
      relation: "member",
    });
    const r = await t.mutation(api.example.setRelation, {
      memberRef: "user_1",
      resourceRef: "org_1",
      fromRelation: "member",
      toRelation: "member",
    });
    expect(r).toEqual({ ok: true });
    const list = await t.query(api.example.listMembers, {
      resourceRef: "org_1",
      paginationOpts: PAGE,
    });
    expect(list.page).toHaveLength(1);
    expect(list.page[0].relation).toBe("member");
  });

  test("setRelation on a missing edge is rejected (NOT_FOUND)", async () => {
    const t = setup();
    const r = await t.mutation(api.example.setRelation, {
      memberRef: "user_1",
      resourceRef: "org_1",
      fromRelation: "member",
      toRelation: "admin",
    });
    expect(r).toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  test("setRelation onto an existing relation is rejected (EXISTS)", async () => {
    const t = setup();
    await t.mutation(api.example.add, {
      memberRef: "user_1",
      resourceRef: "org_1",
      relation: "member",
    });
    await t.mutation(api.example.add, {
      memberRef: "user_1",
      resourceRef: "org_1",
      relation: "admin",
    });
    const r = await t.mutation(api.example.setRelation, {
      memberRef: "user_1",
      resourceRef: "org_1",
      fromRelation: "member",
      toRelation: "admin",
    });
    expect(r).toEqual({ ok: false, reason: "EXISTS" });
  });
});

describe("memberships — listMembers", () => {
  test("lists every member of a resource when no relation is given", async () => {
    const t = setup();
    await t.mutation(api.example.add, {
      memberRef: "user_1",
      resourceRef: "org_1",
      relation: "member",
    });
    await t.mutation(api.example.add, {
      memberRef: "user_2",
      resourceRef: "org_1",
      relation: "admin",
    });
    const list = await t.query(api.example.listMembers, {
      resourceRef: "org_1",
      paginationOpts: PAGE,
    });
    expect(list.page).toHaveLength(2);
    expect(list.isDone).toBe(true);
    expect(list.page).toContainEqual({
      memberRef: "user_1",
      memberKind: "user",
      relation: "member",
    });
    expect(list.page).toContainEqual({
      memberRef: "user_2",
      memberKind: "user",
      relation: "admin",
    });
  });

  test("filters to a single relation when given", async () => {
    const t = setup();
    await t.mutation(api.example.add, {
      memberRef: "user_1",
      resourceRef: "org_1",
      relation: "member",
    });
    await t.mutation(api.example.add, {
      memberRef: "user_2",
      resourceRef: "org_1",
      relation: "admin",
    });
    const admins = await t.query(api.example.listMembers, {
      resourceRef: "org_1",
      relation: "admin",
      paginationOpts: PAGE,
    });
    expect(admins.page).toEqual([
      { memberRef: "user_2", memberKind: "user", relation: "admin" },
    ]);
  });

  test("paginates across pages — every member seen exactly once", async () => {
    const t = setup();
    for (let i = 0; i < 5; i++) {
      await t.mutation(api.example.add, {
        memberRef: `user_${i}`,
        resourceRef: "org_1",
        relation: "member",
      });
    }
    const seen: string[] = [];
    let cursor: string | null = null;
    let isDone = false;
    let guard = 0;
    while (!isDone && guard < 10) {
      const res = await t.query(api.example.listMembers, {
        resourceRef: "org_1",
        paginationOpts: { numItems: 2, cursor },
      });
      for (const row of res.page) seen.push(row.memberRef);
      cursor = res.continueCursor;
      isDone = res.isDone;
      guard++;
    }
    expect(isDone).toBe(true);
    expect(seen.sort()).toEqual([
      "user_0",
      "user_1",
      "user_2",
      "user_3",
      "user_4",
    ]);
    expect(new Set(seen).size).toBe(5);
  });

  test("empty when the resource has no members", async () => {
    const t = setup();
    const res = await t.query(api.example.listMembers, {
      resourceRef: "void",
      paginationOpts: PAGE,
    });
    expect(res.page).toEqual([]);
    expect(res.isDone).toBe(true);
  });

  test("respects the custom-option client (listOwners)", async () => {
    const t = setup();
    await t.mutation(api.example.addDefault, {
      memberRef: "team_1",
      resourceRef: "org_1",
    });
    const owners = await t.query(api.example.listOwners, {
      resourceRef: "org_1",
      paginationOpts: PAGE,
    });
    expect(owners.page).toEqual([
      { memberRef: "team_1", memberKind: "group", relation: "owner" },
    ]);
  });
});

describe("memberships — members", () => {
  test("lists every resource a member relates to", async () => {
    const t = setup();
    await t.mutation(api.example.add, {
      memberRef: "user_1",
      resourceRef: "org_1",
      relation: "member",
    });
    await t.mutation(api.example.add, {
      memberRef: "user_1",
      resourceRef: "org_2",
      relation: "admin",
    });
    const resources = await t.query(api.example.members, {
      memberRef: "user_1",
      paginationOpts: PAGE,
    });
    expect(resources.page).toHaveLength(2);
    expect(resources.page).toContainEqual({
      resourceRef: "org_1",
      relation: "member",
    });
    expect(resources.page).toContainEqual({
      resourceRef: "org_2",
      relation: "admin",
    });
  });

  test("paginates a member's resources across pages", async () => {
    const t = setup();
    for (let i = 0; i < 5; i++) {
      await t.mutation(api.example.add, {
        memberRef: "user_1",
        resourceRef: `org_${i}`,
        relation: "member",
      });
    }
    const seen: string[] = [];
    let cursor: string | null = null;
    let isDone = false;
    let guard = 0;
    while (!isDone && guard < 10) {
      const res = await t.query(api.example.members, {
        memberRef: "user_1",
        paginationOpts: { numItems: 2, cursor },
      });
      for (const row of res.page) seen.push(row.resourceRef);
      cursor = res.continueCursor;
      isDone = res.isDone;
      guard++;
    }
    expect(isDone).toBe(true);
    expect(new Set(seen).size).toBe(5);
  });

  test("empty when the member relates to nothing", async () => {
    const t = setup();
    const res = await t.query(api.example.members, {
      memberRef: "loner",
      paginationOpts: PAGE,
    });
    expect(res.page).toEqual([]);
  });
});

describe("memberships — isMember", () => {
  test("with relation: true for the exact edge, false otherwise", async () => {
    const t = setup();
    await t.mutation(api.example.add, {
      memberRef: "user_1",
      resourceRef: "org_1",
      relation: "member",
    });
    expect(
      await t.query(api.example.isMember, {
        memberRef: "user_1",
        resourceRef: "org_1",
        relation: "member",
      }),
    ).toBe(true);
    expect(
      await t.query(api.example.isMember, {
        memberRef: "user_1",
        resourceRef: "org_1",
        relation: "admin",
      }),
    ).toBe(false);
  });

  test("without relation: bounded lookup is exact across multiple resources", async () => {
    const t = setup();
    await t.mutation(api.example.add, {
      memberRef: "user_1",
      resourceRef: "org_1",
      relation: "admin",
    });
    await t.mutation(api.example.add, {
      memberRef: "user_1",
      resourceRef: "org_2",
      relation: "member",
    });
    expect(
      await t.query(api.example.isMember, {
        memberRef: "user_1",
        resourceRef: "org_1",
      }),
    ).toBe(true);
    expect(
      await t.query(api.example.isMember, {
        memberRef: "user_1",
        resourceRef: "org_2",
      }),
    ).toBe(true);
    expect(
      await t.query(api.example.isMember, {
        memberRef: "user_1",
        resourceRef: "org_3",
      }),
    ).toBe(false);
  });
});

describe("memberships — documents", () => {
  test("scopes by member when only memberRef is given", async () => {
    const t = setup();
    await t.mutation(api.example.add, {
      memberRef: "user_1",
      resourceRef: "org_1",
      relation: "member",
    });
    await t.mutation(api.example.add, {
      memberRef: "user_2",
      resourceRef: "org_1",
      relation: "member",
    });
    const docs = await t.query(api.example.documents, {
      memberRef: "user_1",
      paginationOpts: PAGE,
    });
    expect(docs.page).toHaveLength(1);
    expect(docs.page[0].memberRef).toBe("user_1");
  });

  test("paginates all edges when unscoped", async () => {
    const t = setup();
    await t.mutation(api.example.add, {
      memberRef: "user_1",
      resourceRef: "org_1",
      relation: "member",
    });
    await t.mutation(api.example.add, {
      memberRef: "user_2",
      resourceRef: "org_2",
      relation: "member",
    });
    const docs = await t.query(api.example.documents, { paginationOpts: PAGE });
    expect(docs.page).toHaveLength(2);
    expect(docs.isDone).toBe(true);
  });
});

describe("memberships — client options (custom relation + kind)", () => {
  test("default relation 'owner' and kind 'group' are applied", async () => {
    const t = setup();
    const id = await t.mutation(api.example.addDefault, {
      memberRef: "team_1",
      resourceRef: "org_1",
    });
    expect(typeof id).toBe("string");
    const owners = await t.query(api.example.listOwners, {
      resourceRef: "org_1",
      paginationOpts: PAGE,
    });
    expect(owners.page).toEqual([
      { memberRef: "team_1", memberKind: "group", relation: "owner" },
    ]);
  });
});
