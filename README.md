<!-- Badges -->
[![npm](https://img.shields.io/npm/v/@vllnt/convex-memberships.svg)](https://www.npmjs.com/package/@vllnt/convex-memberships)
[![CI](https://github.com/vllnt/convex-memberships/actions/workflows/ci.yml/badge.svg)](https://github.com/vllnt/convex-memberships/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@vllnt/convex-memberships.svg)](./LICENSE)

# @vllnt/convex-memberships

Auth-agnostic membership and relationship graph (ReBAC tuples), as a Convex
component.

Store flat relationship edges — a tuple is `(memberRef, resourceRef, relation)`,
classified by an opaque `memberKind` (e.g. `user`, `group`, `resource`, or any
host-defined kind). List a resource's members, list a member's resources, check a
membership, change a relation. Domain-neutral: org membership, document sharing,
team roles, group nesting — any "who relates to what, and how" question. The host
owns identity, auth, and the rich entity; this component owns only the edges.

FLAT edges only — there is no transitive expansion in this version (a member of a
group that is a member of an org is **not** auto-resolved to a member of the org).
Transitive expansion is planned for vNext.

## Features

- **Flat ReBAC tuples** — `(memberRef, resourceRef, relation)` with an opaque,
  host-classified `memberKind` (defaults to `"user"`) and an optional opaque
  `status` lifecycle marker.
- **Idempotent edges** — `add` dedupes on the full tuple and returns the existing
  id; no duplicate rows.
- **Paginated listing** — members of a resource, and resources of a member, both
  paginated (`{ numItems, cursor }` → `{ page, isDone, continueCursor }`) for
  guild/workspace scale.
- **Relation filtering** — list members narrowed to a single relation.
- **Bounded membership checks** — exact-relation, or any-relation via the
  `by_member_resource` index (not a full member scan).
- **Relation transitions** — move an edge from one relation to another, guarded
  against collisions; a no-op when from equals to.
- **Auditable removal** — `remove` returns `{ removed }`.
- **Document view** — `documents` exposes the stored `createdAt` and `status`.
- **Opaque refs** — `memberRef`, `resourceRef`, `relation`, `memberKind`, and
  `status` are arbitrary host strings; the component never inspects them.

## Architecture

```
src/
├── shared.ts              # constants + types (pure)
├── test.ts                # convex-test register() helper
├── client/                # Memberships class (the public API)
└── component/             # schema (memberships) + mutations + queries
```

Sandboxed table: `memberships {memberRef, memberKind, resourceRef, relation,
status?, createdAt}`, indexed `by_member`, `by_resource`,
`by_resource_relation`, `by_member_resource` (bounded membership check), and
`by_tuple` (the uniqueness key for an edge).

## Installation

```bash
pnpm add @vllnt/convex-memberships
```

Peer dependency: `convex@^1.36.1`.

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
// convex/teams.ts — host owns auth; pass opaque refs in.
import { components } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Memberships } from "@vllnt/convex-memberships";

const memberships = new Memberships(components.memberships);

export const join = mutation({
  args: { userId: v.string(), orgId: v.string() },
  handler: (ctx, { userId, orgId }) => memberships.add(ctx, userId, orgId),
});

export const isInOrg = query({
  args: { userId: v.string(), orgId: v.string() },
  handler: (ctx, { userId, orgId }) =>
    memberships.isMember(ctx, userId, orgId),
});
```

## API Reference

See [docs/API.md](docs/API.md). Summary:

| Method | Kind | Result |
|--------|------|--------|
| `add(ctx, memberRef, resourceRef, relation?, memberKind?, status?)` | mutation | `id` (idempotent — existing id if held) |
| `remove(ctx, memberRef, resourceRef, relation?)` | mutation | `{ removed }` (idempotent) |
| `setRelation(ctx, memberRef, resourceRef, fromRelation, toRelation)` | mutation | `{ ok, reason? }` (`NOT_FOUND` \| `EXISTS`) |
| `listMembers(ctx, resourceRef, paginationOpts, relation?)` | query | `Page<MemberEntry>` |
| `members(ctx, memberRef, paginationOpts)` | query | `Page<ResourceEntry>` |
| `isMember(ctx, memberRef, resourceRef, relation?)` | query | `boolean` |
| `documents(ctx, paginationOpts, filter?)` | query | `Page<MembershipDoc>` |

Paginated queries take `paginationOpts` (`{ numItems, cursor }`) and return
`{ page, isDone, continueCursor }`. Transitive expansion (`expandMembers` /
`resolve`) is **vNext** — edges are flat today.

Client options: `new Memberships(component, { defaultRelation = "member",
defaultMemberKind = "user" })`.

## React

An optional, tree-shakeable `./react` entry ships thin hooks over
`convex/react`'s `useQuery`. `react` is an **optional peer dependency** — a
backend-only consumer installs and runs with zero React. Each hook takes the
**host app's** re-exported component query reference (the host owns its `api`;
this layer never imports it) and returns the result, or `undefined` while it
loads.

```tsx
import {
  useIsMember,
  useMembers,
  useListMembers,
} from "@vllnt/convex-memberships/react";
import { api } from "../convex/_generated/api";

function AdminBadge({ userId, orgId }: { userId: string; orgId: string }) {
  const isAdmin = useIsMember(api.memberships.isMember, {
    memberRef: userId,
    resourceRef: orgId,
    relation: "admin",
  });
  if (isAdmin === undefined) return null; // loading
  return isAdmin ? <span>Admin</span> : null;
}
```

| Hook | Args | Returns |
|------|------|---------|
| `useIsMember(isMemberRef, { memberRef, resourceRef, relation? })` | the host's `isMember` ref | `boolean \| undefined` |
| `useMembers(membersRef, { memberRef })` | the host's `members` ref | first page of resource entries `\| undefined` |
| `useListMembers(listMembersRef, { resourceRef, relation? })` | the host's `listMembers` ref | first page of member entries `\| undefined` |

The host re-exports the component's queries (e.g.
`export const { isMember, members, listMembers } = ...`) so the refs are typed
end to end. The component holds no secrets — only membership metadata derived
from the caller's own refs reaches the client.

## Security Model

The component is **auth-agnostic**: it never authenticates or authorizes. The
host resolves identity, decides whether a caller may create an edge, and passes
opaque `memberRef` / `resourceRef` strings. Component tables are sandboxed — the
host reaches them only through the exported functions. `memberRef`,
`resourceRef`, and `relation` are opaque; the component never inspects or
de-references them.

## Testing

```bash
pnpm test           # single run
pnpm test:coverage  # enforced 100% on covered files
```

Tests run against the real component runtime via `convex-test` (`@edge-runtime/vm`), not mocks.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
