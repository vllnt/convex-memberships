<!-- Badges -->

[![convex component](https://img.shields.io/badge/convex-component-EE342F.svg)](https://www.convex.dev/components)
[![npm](https://img.shields.io/npm/v/@vllnt/convex-memberships.svg)](https://www.npmjs.com/package/@vllnt/convex-memberships)
[![CI](https://github.com/vllnt/convex-memberships/actions/workflows/ci.yml/badge.svg)](https://github.com/vllnt/convex-memberships/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@vllnt/convex-memberships.svg)](./LICENSE)

# @vllnt/convex-memberships

Auth-agnostic membership and relationship graph (ReBAC tuples), as a Convex
component.

```ts
const memberships = new Memberships(components.memberships);
await memberships.add(ctx, userId, orgId, "admin");
const isAdmin = await memberships.isMember(ctx, userId, orgId, "admin");
```

A tuple is `(memberRef, resourceRef, relation)`, classified by an opaque
`memberKind`. Domain-neutral: org membership, document sharing, team roles,
group nesting — any "who relates to what, and how" question. Edges are **flat**
— transitive expansion (a member of a group that is a member of an org) is
**not** auto-resolved; it is planned for vNext.

## Features

- **Flat ReBAC tuples** — `(memberRef, resourceRef, relation)` with an opaque
  `memberKind` (defaults `"user"`) and optional `status`.
- **Idempotent edges** — `add` dedupes on the full tuple, returning the existing
  id and patching `memberKind` / `status`.
- **Paginated listing** — members of a resource, and resources of a member, both
  paginated for guild/workspace scale.
- **Relation filtering** — list members narrowed to a single relation.
- **Bounded membership checks** — exact-relation, or any-relation via index (not
  a full member scan).
- **Guarded relation transitions** — `setRelation` moves an edge, guarded
  against collisions; missing source ⇒ `NOT_FOUND`.
- **Auditable removal** — `remove` returns `{ removed }`; `documents` exposes
  stored `createdAt` and `status`.
- **Opaque refs** — every ref/relation/kind/status is an arbitrary host string
  the component never inspects.

## Installation

```bash
pnpm add @vllnt/convex-memberships
```

Requires `convex@^1.45.0`; React `>=18` is optional for `./react` only. The
command installs the latest stable release; use
`@vllnt/convex-memberships@canary` for the newest pre-release build. Pin a
resolved canary version for reproducible installs.

## Usage

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import memberships from "@vllnt/convex-memberships/convex.config";

const app = defineApp();
app.use(memberships);
export default app;
```

```ts
// convex/teams.ts — check the authenticated caller's exact relation.
import { components } from "./_generated/api";
import { query } from "./_generated/server";
import { v } from "convex/values";
import { Memberships } from "@vllnt/convex-memberships";

const memberships = new Memberships(components.memberships);

export const isInOrg = query({
  args: { orgId: v.string() },
  handler: async (ctx, { orgId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    return memberships.isMember(ctx, identity.tokenIdentifier, orgId, "member");
  },
});
```

Create edges only in host mutations that authorize the caller to manage the
resource; use the same identity mapping as the query (`tokenIdentifier` here). A
`status` value is metadata, not an extra authorization filter for `isMember`.

Client defaults:
`new Memberships(component, { defaultRelation: "member", defaultMemberKind: "user" })`.

## API Reference

| Method                                                               | Kind     | Result                                                           |
| -------------------------------------------------------------------- | -------- | ---------------------------------------------------------------- |
| `add(ctx, memberRef, resourceRef, relation?, memberKind?, status?)`  | mutation | `id` (tuple-idempotent; patches `memberKind`/`status` on re-add) |
| `remove(ctx, memberRef, resourceRef, relation?)`                     | mutation | `{ removed }` (idempotent)                                       |
| `setRelation(ctx, memberRef, resourceRef, fromRelation, toRelation)` | mutation | `{ ok, reason? }` (`NOT_FOUND` \| `EXISTS`)                      |
| `listMembers(ctx, resourceRef, paginationOpts, relation?)`           | query    | `Page<MemberEntry>`                                              |
| `members(ctx, memberRef, paginationOpts)`                            | query    | `Page<ResourceEntry>`                                            |
| `isMember(ctx, memberRef, resourceRef, relation?)`                   | query    | `boolean`                                                        |
| `documents(ctx, paginationOpts, filter?)`                            | query    | `Page<MembershipDoc>`                                            |

All listing methods require `paginationOpts.numItems` to be an integer from 1
through 1000 and cap `maximumRowsRead` at 1000, including reactive cursor
ranges. Invalid numeric pagination options throw `INVALID_PAGE_SIZE`.

### Errors

Errors are `ConvexError`s with a stable `data.code`.

| Code                | Thrown by                             | Meaning                                                       |
| ------------------- | ------------------------------------- | ------------------------------------------------------------- |
| `INVALID_ARGUMENT`  | `add`, `remove`, `setRelation`        | A ref, relation, `memberKind` or `status` was an empty string |
| `INVALID_PAGE_SIZE` | `listMembers`, `members`, `documents` | `numItems` / `maximumRowsRead` is not a valid bounded integer |

Queries never reject empty strings, so a UI can call them with placeholder
values while an id is loading; they simply find nothing (`isMember` is `false`).

Full reference: [docs/API.md](docs/API.md).

## React

An optional, tree-shakeable `./react` entry ships thin hooks over
`convex/react`'s `useQuery`. `react` is an optional peer dependency — a
backend-only consumer pulls zero React. Each hook takes the host app's
re-exported query reference.

```tsx
import { useIsMember } from "@vllnt/convex-memberships/react";
import { api } from "../convex/_generated/api";

const isAdmin = useIsMember(api.memberships.isMember, {
  memberRef: userId,
  resourceRef: orgId,
  relation: "admin",
}); // boolean | undefined (undefined while loading)
```

| Hook                                                              | Args                         | Returns                                       |
| ----------------------------------------------------------------- | ---------------------------- | --------------------------------------------- |
| `useIsMember(isMemberRef, { memberRef, resourceRef, relation? })` | the host's `isMember` ref    | `boolean \| undefined`                        |
| `useMembers(membersRef, { memberRef })`                           | the host's `members` ref     | first page of resource entries `\| undefined` |
| `useListMembers(listMembersRef, { resourceRef, relation? })`      | the host's `listMembers` ref | first page of member entries `\| undefined`   |

`useMembers` and `useListMembers` always request
`{ numItems: 100, cursor: null }`. They return only the first page and do not
expose a load-more control. For a full listing, call a host-authorized paginated
query and advance `continueCursor` until `isDone` (or use Convex's
`usePaginatedQuery`). Host wrappers must authorize the requested
member/resource; accepting the hook's args is not authorization.

## Security

- **Auth-agnostic** — the host resolves identity, decides who may create/read an
  edge, and passes opaque refs; tables are sandboxed (reached only via the
  client).
- **`isMember` footgun** — called without `relation`, it returns `true` for
  **any** stored relation (`"invited"`, `"suspended"`, `"banned"`, …). For authz
  gates, always pass `relation` or enumerate the relations your policy accepts.
- **The host enforces roles and permissions.** The component is a plain tuple
  store: it does not know which relation is an owner or admin, and it cannot
  read `ctx.auth`. `add`, `remove` and `setRelation` act on whatever refs the
  host passes, so the host must check that the caller may manage the resource
  _and_ may grant or revoke that specific relation (a member must not be able to
  `add` themselves as `owner` or `setRelation` to a higher role).
- **Last-owner protection is the host's job.** Before `remove` or `setRelation`
  on an owner edge, count the remaining owners with
  `listMembers(ctx, resourceRef, { numItems: 2, cursor: null }, "owner")` in the
  same mutation (mutations are serialized, so the check and the write are
  atomic) and refuse if it would leave none.
- **`add` overwrites on re-add.** Re-adding an existing tuple resets its
  `memberKind` and `status` to the incoming values (`status` becomes unset if
  omitted), so a host that stamps `"suspended"` must pass it again.

See [docs/API.md](docs/API.md).

## Testing

```bash
pnpm test           # single run
pnpm test:coverage  # enforced 100% on covered files
```

Tests run against the real component runtime via `convex-test`
(`@edge-runtime/vm`), not mocks.

### Testing your app

`@vllnt/convex-memberships/test` exports `register(t, name = "memberships")` to
mount the component in a `convex-test` instance. It needs `convex-test` and
`vitest` (with Vite's `import.meta.glob`) in the consuming app:

```ts
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { register } from "@vllnt/convex-memberships/test";
import schema from "./schema";

const t = convexTest(schema, import.meta.glob("./**/*.ts"));
register(t);
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Author

Built by [bntvllnt](https://github.com/bntvllnt) ·
[bntvllnt.com](https://bntvllnt.com) · [X @bntvllnt](https://x.com/bntvllnt)

Part of the [@vllnt](https://github.com/vllnt) Convex component fleet —
[vllnt.com](https://vllnt.com)

If this is useful, [sponsor the work](https://github.com/sponsors/bntvllnt).

## License

MIT — see [LICENSE](LICENSE).
