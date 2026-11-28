# @vllnt/convex-memberships

TypeScript Convex component for memberships and roles: a flat ReBAC
relationship graph with membership checks, paginated member lists and React
hooks.

## For coding agents

Docs for the installed version are in `node_modules/@vllnt/convex-memberships/`:
`docs/API.md`, `llms.txt`, `CHANGELOG.md` and the TypeScript `src/`. Read them
before writing code against this package.

## When to use

- Use it when users or groups belong to orgs, teams or workspaces with a role.
- Use it when you share resources (documents, projects) and must list who has
  access, or what one member can reach.
- Do not use it when a group is short-lived (one match, lobby, room or cohort)
  and needs a capacity limit, an open/locked/closed lifecycle or batched erase:
  use [`@vllnt/convex-buckets`](https://oss.vllnt.com/packages/convex-buckets).
- Do not use it when you need to decide what a role may do (action grants,
  deny by default): use
  [`@vllnt/convex-permissions`](https://oss.vllnt.com/packages/convex-permissions).
- Do not use it when nested groups must resolve for you (a member of a group
  that is a member of an org): edges are flat, so walk them with `members`.

## Install

```bash
pnpm add @vllnt/convex-memberships
```

## Quick start

```ts
// convex/convex.config.ts
import memberships from "@vllnt/convex-memberships/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(memberships);
export default app;
```

```ts
// convex/orgs.ts
import { Memberships } from "@vllnt/convex-memberships";
import { ConvexError, v } from "convex/values";

import { components } from "./_generated/api";
import { mutation, query } from "./_generated/server";

const memberships = new Memberships(components.memberships);

export const createOrg = mutation({
  args: { orgId: v.string() },
  returns: v.string(),
  handler: async (ctx, { orgId }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) throw new ConvexError("not signed in");
    const owners = await memberships.listMembers(
      ctx,
      orgId,
      { numItems: 1, cursor: null },
      "owner",
    );
    if (owners.page.length > 0) throw new ConvexError("org already exists");
    return memberships.add(ctx, user.tokenIdentifier, orgId, "owner");
  },
});

export const isOwner = query({
  args: { orgId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { orgId }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) return false;
    return memberships.isMember(ctx, user.tokenIdentifier, orgId, "owner");
  },
});
```

Run `npx convex dev` once to generate `components.memberships`. The component
never reads auth: the host derives `memberRef` (here the user's
`tokenIdentifier`) and decides who may read or write each edge. `createOrg`
lets any signed-in user claim an `orgId` that has no owner yet; in a real app,
create the org row in your own table first and use its id. The latest
stable release is on the default npm tag; builds from `main` use the `canary`
tag.

## API

Full reference: [docs/API.md](docs/API.md).

| Export                                                                                                       | Import from                                      | What it does                                                              |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------- |
| [`Memberships`](docs/API.md#memberships)                                                                     | `@vllnt/convex-memberships`                      | Host client: `new Memberships(components.memberships, options?)`          |
| [`add(ctx, memberRef, resourceRef, relation?, memberKind?, status?)`](docs/API.md#add)                       | `Memberships` method, mutation                   | Add an edge, or patch `memberKind` / `status` of an existing one; returns its id |
| [`remove(ctx, memberRef, resourceRef, relation?)`](docs/API.md#remove)                                       | `Memberships` method, mutation                   | Delete an edge; returns `{ removed }`                                     |
| [`setRelation(ctx, memberRef, resourceRef, fromRelation, toRelation)`](docs/API.md#setrelation)              | `Memberships` method, mutation                   | Move an edge to another relation; returns `{ ok, reason? }`               |
| [`listMembers(ctx, resourceRef, paginationOpts, relation?)`](docs/API.md#listmembers)                        | `Memberships` method, query                      | One page of a resource's members                                          |
| [`members(ctx, memberRef, paginationOpts)`](docs/API.md#members)                                             | `Memberships` method, query                      | One page of the resources a member relates to                             |
| [`isMember(ctx, memberRef, resourceRef, relation?)`](docs/API.md#ismember)                                   | `Memberships` method, query                      | Whether the edge exists (any relation when `relation` is omitted)         |
| [`documents(ctx, paginationOpts, filter?)`](docs/API.md#documents)                                           | `Memberships` method, query                      | One page of full edges with `status` and `createdAt`                      |
| [`MembershipsComponent`](docs/API.md#membershipscomponent)                                                   | `@vllnt/convex-memberships` (type)               | Type of `components.memberships`                                          |
| [`MembershipsOptions`](docs/API.md#membershipsoptions)                                                       | `@vllnt/convex-memberships` (type)               | `{ defaultRelation?, defaultMemberKind? }`                                |
| [`MemberEntry`](docs/API.md#memberentry)                                                                     | `@vllnt/convex-memberships` (type)               | Row of `listMembers`: `{ memberRef, memberKind, relation }`               |
| [`ResourceEntry`](docs/API.md#resourceentry)                                                                 | `@vllnt/convex-memberships` (type)               | Row of `members`: `{ resourceRef, relation }`                             |
| [`MembershipDoc`](docs/API.md#membershipdoc)                                                                 | `@vllnt/convex-memberships` (type)               | Row of `documents`                                                        |
| [`MemberKind`](docs/API.md#memberkind)                                                                       | `@vllnt/convex-memberships` (type)               | Opaque member classification, `string`                                    |
| [`Page`](docs/API.md#page)                                                                                   | `@vllnt/convex-memberships` (type)               | `{ page, isDone, continueCursor }`                                        |
| [`PaginationOptions`](docs/API.md#paginationoptions)                                                         | `@vllnt/convex-memberships` (type)               | Convex `{ numItems, cursor, ... }`, re-exported                           |
| [`RemoveResult`](docs/API.md#removeresult)                                                                   | `@vllnt/convex-memberships` (type)               | Result of `remove`                                                        |
| [`SetRelationResult`](docs/API.md#setrelationresult)                                                         | `@vllnt/convex-memberships` (type)               | Result of `setRelation`                                                   |
| [`SetRelationReason`](docs/API.md#setrelationreason)                                                         | `@vllnt/convex-memberships` (type)               | `"NOT_FOUND" \| "EXISTS"`                                                 |
| [`useIsMember`](docs/API.md#useismember)                                                                     | `@vllnt/convex-memberships/react`                | React hook over the host's `isMember` query                               |
| [`useMembers`](docs/API.md#usemembers)                                                                       | `@vllnt/convex-memberships/react`                | React hook: first page (100) of the host's `members` query                |
| [`useListMembers`](docs/API.md#uselistmembers)                                                               | `@vllnt/convex-memberships/react`                | React hook: first page (100) of the host's `listMembers` query            |
| [`IsMemberRef`](docs/API.md#ismemberref)                                                                     | `@vllnt/convex-memberships/react` (type)         | Query reference type `useIsMember` accepts                                |
| [`MembersRef`](docs/API.md#membersref)                                                                       | `@vllnt/convex-memberships/react` (type)         | Query reference type `useMembers` accepts                                 |
| [`ListMembersRef`](docs/API.md#listmembersref)                                                               | `@vllnt/convex-memberships/react` (type)         | Query reference type `useListMembers` accepts                             |
| [`default` (component config)](docs/API.md#convexconfig)                                                     | `@vllnt/convex-memberships/convex.config`        | Pass to `app.use(...)`                                                    |
| [`register`](docs/API.md#register)                                                                           | `@vllnt/convex-memberships/test`                 | Mount the component in `convex-test`                                      |
| [`ComponentApi`](docs/API.md#componentapi)                                                                   | `@vllnt/convex-memberships/_generated/component` | Generated type of the mounted component                                   |

## Common tasks

Add a member, promote them and remove them, as an owner. The last owner cannot
be removed: the component does not know which relation is an owner, so the host
checks it in the same mutation (Convex runs each mutation as one transaction).

```ts
// convex/members.ts
import { Memberships } from "@vllnt/convex-memberships";
import type { GenericDataModel, GenericQueryCtx } from "convex/server";
import { ConvexError, v } from "convex/values";

import { components } from "./_generated/api";
import { mutation } from "./_generated/server";

const memberships = new Memberships(components.memberships);

type Ctx = Pick<GenericQueryCtx<GenericDataModel>, "auth" | "runQuery">;

async function requireOwner(ctx: Ctx, orgId: string): Promise<void> {
  const user = await ctx.auth.getUserIdentity();
  if (user === null) throw new ConvexError("not signed in");
  if (!(await memberships.isMember(ctx, user.tokenIdentifier, orgId, "owner")))
    throw new ConvexError("only owners manage members");
}

export const addMember = mutation({
  args: { orgId: v.string(), userRef: v.string() },
  returns: v.string(),
  handler: async (ctx, { orgId, userRef }) => {
    await requireOwner(ctx, orgId);
    return memberships.add(ctx, userRef, orgId, "member");
  },
});

export const promoteToAdmin = mutation({
  args: { orgId: v.string(), userRef: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { orgId, userRef }) => {
    await requireOwner(ctx, orgId);
    const result = await memberships.setRelation(
      ctx,
      userRef,
      orgId,
      "member",
      "admin",
    );
    if (result.reason === "EXISTS") throw new ConvexError("already an admin");
    return result.ok;
  },
});

export const removeMember = mutation({
  args: { orgId: v.string(), userRef: v.string(), relation: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { orgId, userRef, relation }) => {
    await requireOwner(ctx, orgId);
    const isOwnerEdge = await memberships.isMember(ctx, userRef, orgId, "owner");
    if (relation === "owner" && isOwnerEdge) {
      const owners = await memberships.listMembers(
        ctx,
        orgId,
        { numItems: 2, cursor: null },
        "owner",
      );
      if (owners.page.length < 2) throw new ConvexError("keep one owner");
    }
    const { removed } = await memberships.remove(ctx, userRef, orgId, relation);
    return removed;
  },
});
```

List the members of an org with a cursor, for members of that org only. Each
relation is checked by name, because `isMember` without `relation` also matches
relations such as `"invited"` or `"banned"`, and the page keeps only those
roles (so a page can hold fewer than `numItems` rows):

```ts
// convex/directory.ts
import { Memberships } from "@vllnt/convex-memberships";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";

import { components } from "./_generated/api";
import { query } from "./_generated/server";

const memberships = new Memberships(components.memberships);
const ROLES = ["owner", "admin", "member"];

export const orgMembers = query({
  args: { orgId: v.string(), paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(
      v.object({
        memberRef: v.string(),
        memberKind: v.string(),
        relation: v.string(),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, { orgId, paginationOpts }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) throw new ConvexError("not signed in");
    const checks = ROLES.map((role) =>
      memberships.isMember(ctx, user.tokenIdentifier, orgId, role),
    );
    if (!(await Promise.all(checks)).includes(true))
      throw new ConvexError("not a member");
    const result = await memberships.listMembers(ctx, orgId, paginationOpts);
    const page = result.page.filter((entry) => ROLES.includes(entry.relation));
    return { ...result, page };
  },
});
```

Show a badge in React. The hooks take a host query; this one answers only for
the signed-in user's own `tokenIdentifier`, and only for a named relation:

```ts
// convex/memberships.ts
import { Memberships } from "@vllnt/convex-memberships";
import { v } from "convex/values";

import { components } from "./_generated/api";
import { query } from "./_generated/server";

const memberships = new Memberships(components.memberships);

export const isMember = query({
  args: {
    memberRef: v.string(),
    resourceRef: v.string(),
    relation: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, { memberRef, resourceRef, relation }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null || user.tokenIdentifier !== memberRef) return false;
    if (relation === undefined) return false;
    return memberships.isMember(ctx, memberRef, resourceRef, relation);
  },
});
```

```tsx
// src/OwnerBadge.tsx
import { useIsMember } from "@vllnt/convex-memberships/react";

import { api } from "../convex/_generated/api";

export function OwnerBadge(props: { userRef: string; orgId: string }) {
  const isOwner = useIsMember(api.memberships.isMember, {
    memberRef: props.userRef,
    resourceRef: props.orgId,
    relation: "owner",
  });
  return isOwner === true ? <span>Owner</span> : null;
}
```

`isOwner` is `undefined` while the query loads. The badge works only for the
signed-in user: for any other `userRef` the host query returns `false`.

## Errors and fixes

Invalid input throws a `ConvexError` whose `data` is `{ code, message }`. Catch
it in the host with `error instanceof ConvexError` and read `error.data.code`.

| Code                | Message                                                           | Thrown by                             | Cause                                                                                                                    | Fix                                                                                         |
| ------------------- | ----------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `INVALID_ARGUMENT`  | `<field> must not be empty` (for example `relation must not be empty`) | `add`, `remove`, `setRelation`        | `memberRef`, `resourceRef`, `relation`, `memberKind`, `status`, `fromRelation` or `toRelation` is `""`, including an empty `defaultRelation` or `defaultMemberKind` | Pass a non-empty string; omit `status` instead of passing `""`                              |
| `INVALID_PAGE_SIZE` | `paginationOpts.numItems must be an integer between 1 and 1000`   | `listMembers`, `members`, `documents` | `numItems` is below 1, above 1000, fractional, `NaN` or infinite                                                         | Pass an integer from 1 through 1000                                                         |
| `INVALID_PAGE_SIZE` | `paginationOpts.maximumRowsRead must be a positive finite integer` | `listMembers`, `members`, `documents` | `maximumRowsRead` is below 1, fractional, `NaN` or infinite                                                              | Pass a positive integer or omit it (values above 1000 are lowered to 1000 without an error) |

Arguments of the wrong type (for example a number `memberRef`) are rejected by
Convex argument validation before the component runs.

`setRelation` does not throw when it cannot move an edge. It returns
`{ ok: false, reason }`:

| `reason`    | Cause                                                                                  | Fix                                                                 |
| ----------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `NOT_FOUND` | No `fromRelation` edge exists for the pair, also when `fromRelation === toRelation`    | Check the current relation with `isMember`, or `add` the edge first |
| `EXISTS`    | A `toRelation` edge already exists for the pair; nothing changed                       | `remove` the `fromRelation` edge if one edge is enough              |

`remove` returns `{ removed: false }` instead of throwing when the edge does not
exist.

## Limits and gotchas

- `numItems` must be an integer from 1 through 1000. `maximumRowsRead` defaults
  to 1000 and is capped at 1000, so a page never reads more than 1000 rows.
- `isMember` without `relation` returns `true` for **any** stored relation,
  including ones such as `"invited"`, `"suspended"` or `"banned"`. Do not use it
  as an authorization check; pass `relation`, or check each accepted relation.
- Edges are flat. A member of a group that is a member of an org is not a
  member of the org; there is no transitive expansion in this version.
- `add` on an existing `(memberRef, resourceRef, relation)` returns the same id
  and overwrites `memberKind` and `status` with the new values. Omitting
  `status` clears a stored `status`; omitting `memberKind` resets it to
  `defaultMemberKind` (`"user"`).
- Writes reject empty strings (`INVALID_ARGUMENT`); queries accept them, so a UI
  can pass `""` while an id loads. Such a query finds nothing unless an edge
  with that empty value was stored by 0.1.0, which accepted empty strings.
- `setRelation(m, r, "x", "x")` returns `{ ok: false, reason: "NOT_FOUND" }`
  when the edge does not exist, and `{ ok: true }` without changes when it does.
- Defaults: `add` and `remove` use `defaultRelation` (`"member"`) when
  `relation` is omitted, and `add` uses `defaultMemberKind` (`"user"`).
  `listMembers` and `isMember` treat an omitted `relation` as any relation.
- Page order is index order, then insertion time: `listMembers` by relation
  (by insertion time only when `relation` is given);
  `members` by resource, then relation; `documents` by relation with
  `resourceRef`, by resource then relation with only `memberRef`, and by
  insertion time with no filter. Do not reuse a cursor issued by 0.1.0: the
  indexes changed, so restart from `cursor: null`.
- `documents` with both `resourceRef` and `memberRef` filters by `resourceRef`
  only. With no filter it pages through every edge in the component.
- `status` is stored metadata. No query filters on it: `isMember` returns
  `true` for a `"suspended"` edge.
- `useMembers` and `useListMembers` load only the first 100 rows and have no
  load-more; use a paginated host query for more.
- The component sets no length limit on refs, relations, `memberKind` or
  `status`, beyond Convex's own value and index limits.

## Compatibility

- Peer dependency: `convex@^1.45.0`. The tests run on the locked convex version
  (1.51.0).
- React `>=18`, optional peer dependency, needed only for
  `@vllnt/convex-memberships/react`. A backend-only app does not install React.
- Node.js: `package.json` declares `>=18`, but convex 1.45 to 1.48 require
  Node.js 20 or later and convex 1.49 to 1.51 require Node.js 22 or later.
- ES modules only: every entry point is ESM (`"type": "module"`).
- `@vllnt/convex-memberships/test` is TypeScript source that uses Vite's
  `import.meta.glob`. It needs `convex-test` and `vite` (for the `vite/client`
  types); the Vitest config shown under Testing also uses `vitest` and
  `@edge-runtime/vm`. It is tested with `convex-test` 0.0.73, which itself
  requires `convex` `^1.46.0`, while this package's peer range starts at
  1.45.0.

## Testing

Mount the component in your own `convex-test` suite with `register`. Use the
Vitest settings `convex-test` recommends (edge runtime, `convex-test` inlined):

```ts
// vitest.config.mts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
  },
});
```

```ts
// convex/orgs.test.ts
/// <reference types="vite/client" />
import { register } from "@vllnt/convex-memberships/test";
import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

test("the creator owns the new org", async () => {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  register(t);
  const alice = t.withIdentity({ tokenIdentifier: "alice" });
  const bob = t.withIdentity({ tokenIdentifier: "bob" });
  await alice.mutation(api.orgs.createOrg, { orgId: "org_1" });
  expect(await alice.query(api.orgs.isOwner, { orgId: "org_1" })).toBe(true);
  expect(await bob.query(api.orgs.isOwner, { orgId: "org_1" })).toBe(false);
});
```

`register(t, name)` takes the mount name when you used
`app.use(memberships, { name })`; the default is `"memberships"`.

This repository's own tests run the component and client in the simulated
`convex-test` runtime without mocks; the React hook tests mock `convex/react`.
`pnpm test:coverage` enforces 100% coverage on the source files listed in
`vitest.config.mts`.
`pnpm test:package` checks the packed tarball, this README and the docs
contract.

## Security

- The component does not authenticate or authorize. It never reads `ctx.auth`
  and does not know which relation is an owner or admin. The host must check
  that the caller may manage the resource **and** may grant or revoke that
  relation (a member must not `add` themselves as `"owner"` or `setRelation`
  to a higher role).
- Never act on a `memberRef` from the client without checking that the caller
  may: an identity match for reads about oneself (the `isMember` wrapper under
  Common tasks), an owner check for admin writes (`addMember`).
- Last-owner protection is the host's job; see `removeMember` under Common
  tasks.
- Its table is reachable only through the component's functions. The React
  hooks call host queries, so the host query decides what a client may read.
  Do not re-export a component query as is for a hook: the hook's args come
  from the client, so any client could read any resource's members.

Report vulnerabilities as described in
[SECURITY.md](https://github.com/vllnt/convex-memberships/blob/main/SECURITY.md).

## Related packages

None. No @vllnt package integrates with this one in code yet: there is no
runtime or peer dependency, shared test or example that uses both.

## Contributing

See
[CONTRIBUTING.md](https://github.com/vllnt/convex-memberships/blob/main/CONTRIBUTING.md).

## Links

- Docs and changelog: [oss.vllnt.com/packages/convex-memberships](https://oss.vllnt.com/packages/convex-memberships) · [release feed](https://oss.vllnt.com/packages/convex-memberships/rss.xml)
- All @vllnt packages: [oss.vllnt.com](https://oss.vllnt.com) · [search packages and docs on index.vllnt.com](https://index.vllnt.com)
- Source and issues: [GitHub](https://github.com/vllnt/convex-memberships) · [issues](https://github.com/vllnt/convex-memberships/issues) · [npm](https://www.npmjs.com/package/@vllnt/convex-memberships)
- Questions and updates: [Discord](https://bntvllnt.com/discord) · [X @bntvllnt](https://x.com/bntvllnt)
- Company and author: [vllnt.com](https://vllnt.com) · [bntvllnt.com](https://bntvllnt.com) · [GitHub @bntvllnt](https://github.com/bntvllnt) · [LinkedIn](https://linkedin.com/in/bntvllnt)
- Sponsor: [GitHub Sponsors](https://github.com/sponsors/bntvllnt)

## License

MIT. See [LICENSE](LICENSE).

[![npm](https://img.shields.io/npm/v/@vllnt/convex-memberships.svg)](https://www.npmjs.com/package/@vllnt/convex-memberships)
[![CI](https://github.com/vllnt/convex-memberships/actions/workflows/ci.yml/badge.svg)](https://github.com/vllnt/convex-memberships/actions/workflows/ci.yml)

---

Part of [vllnt open source](https://oss.vllnt.com) · [Package page](https://oss.vllnt.com/packages/convex-memberships) · [vllnt.com](https://vllnt.com) · Built by [bntvllnt](https://bntvllnt.com)
