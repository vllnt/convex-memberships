# API Reference — @vllnt/convex-memberships

**Compatibility:** `convex@^1.45.0`

## Entry points

| Import                                           | Provides                                                                                                                                                                                                                                                 |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@vllnt/convex-memberships`                      | The `Memberships` client, the `MembershipsComponent` interface, and the types `MemberEntry`, `MemberKind`, `MembershipDoc`, `MembershipsOptions`, `Page`, `PaginationOptions`, `RemoveResult`, `ResourceEntry`, `SetRelationReason`, `SetRelationResult` |
| `@vllnt/convex-memberships/convex.config`        | The component definition. Pass it to `app.use(...)` in the host's `convex/convex.config.ts`.                                                                                                                                                             |
| `@vllnt/convex-memberships/react`                | Optional hooks `useIsMember`, `useMembers`, `useListMembers` and the ref types `IsMemberRef`, `MembersRef`, `ListMembersRef` (see [React](#react)).                                                                                                      |
| `@vllnt/convex-memberships/test`                 | `register(t, name = "memberships")`: mounts the component in a `convex-test` instance. Needs `convex-test` and Vite's `import.meta.glob`.                                                                                                                |
| `@vllnt/convex-memberships/_generated/component` | The `ComponentApi` type for the component's function references (types only).                                                                                                                                                                            |

`./convex.config.js` and `./_generated/component.js` resolve to the same files.

## Client

Construct the client with the mounted component and optional config:

```ts
import { Memberships } from "@vllnt/convex-memberships";
const memberships = new Memberships(components.memberships, {
  defaultRelation: "member", // relation applied when a call omits `relation`
  defaultMemberKind: "user", // member kind applied when a call omits `memberKind`
});
```

All methods take the host `ctx` (a query or mutation context) as the first
argument. A tuple is `(memberRef, resourceRef, relation)`; all three — plus
`memberKind` and the optional `status` — are opaque host strings the component
never inspects. Edges are FLAT — there is no transitive expansion (see
[vNext](#vnext)).

Listing methods are **paginated**: they take a Convex `paginationOpts`
(`{ numItems, cursor }`) and return `{ page, isDone, continueCursor }`.
`numItems` must be an integer from 1 through 1000. `maximumRowsRead`, when
provided, must be a positive finite integer and is capped at 1000 so explicit
reactive cursor ranges remain bounded. Invalid numeric values throw
`INVALID_PAGE_SIZE`. Feed the returned `continueCursor` back as the next call's
`cursor`; `isDone` is true on the last page. Each query returns rows in the
order of the index it reads, then insertion time: `listMembers` by `relation`
within the resource; `members` by `resourceRef`, then `relation`; `documents` by
`relation` when scoped to a `resourceRef`, by `resourceRef` then `relation` when
scoped to a `memberRef`, and by insertion time when unscoped.

Mutations reject an empty `memberRef`, `resourceRef`, `relation`, `memberKind`,
`status`, `fromRelation` or `toRelation` with
`ConvexError({ code: "INVALID_ARGUMENT" })`. Queries accept empty strings
(placeholders) and find nothing. The component performs no role or permission
checks and cannot read `ctx.auth`: the host authorizes the caller and any role
change, and protects the last owner of a resource (see the README Security
section).

## Mutations

### `add(ctx, memberRef, resourceRef, relation?, memberKind?, status?) → id`

Add the edge `(memberRef, resourceRef, relation)`, classified by the opaque
`memberKind` and optionally stamped with an opaque `status`. Idempotent on the
tuple `(memberRef, resourceRef, relation)`: if the exact tuple already exists,
the existing id is returned **and** `memberKind` / `status` are patched to the
incoming values. Re-adding with a different `memberKind` updates the stored
classification — the id is stable, the classification is current. `relation`
defaults to `defaultRelation`, `memberKind` to `defaultMemberKind` (`"user"`).

### `remove(ctx, memberRef, resourceRef, relation?) → { removed }`

Remove the edge `(memberRef, resourceRef, relation)`. Idempotent — returns
`{ removed: true }` when an edge was deleted, `{ removed: false }` when none
existed.

### `setRelation(ctx, memberRef, resourceRef, fromRelation, toRelation) → { ok, reason? }`

Move the member's edge on the resource from `fromRelation` to `toRelation`. The
`fromRelation` edge **must exist** — if it does not, returns
`{ ok: false, reason: "NOT_FOUND" }` regardless of whether `fromRelation` equals
`toRelation`. When the edge exists and `fromRelation === toRelation`, it is a
no-op `{ ok: true }`. Returns `{ ok: false, reason: "EXISTS" }` if a
`toRelation` edge already exists; otherwise patches the relation and returns
`{ ok: true }`. `reason` is the typed union `"NOT_FOUND" | "EXISTS"`.

> **Note:** `setRelation(m, r, "x", "x")` on a non-existent edge returns
> `{ ok: false, reason: "NOT_FOUND" }`, not `{ ok: true }`. The no-op only fires
> when the source edge is confirmed to exist.

## Queries

### `listMembers(ctx, resourceRef, paginationOpts, relation?) → Page<MemberEntry>`

One page of members of `resourceRef` as `{ memberRef, memberKind, relation }`.
Filtered to a single `relation` when given.

### `members(ctx, memberRef, paginationOpts) → Page<ResourceEntry>`

One page of resources `memberRef` relates to, as `{ resourceRef, relation }`.

### `isMember(ctx, memberRef, resourceRef, relation?) → boolean`

Whether `memberRef` relates to `resourceRef`. With `relation`, checks that exact
edge; without, a bounded `by_tuple` index prefix lookup checks whether any
relation connects the two (not a full member scan).

> **Security warning — unscoped path.** When `relation` is omitted, this method
> returns `true` for **any** relation stored between the pair (e.g. `"invited"`,
> `"suspended"`, `"banned"`). Do **not** use the unscoped path as an
> authorization gate without first enumerating every relation your policy
> considers sufficient for the guarded action. Use the scoped path (`relation`
> provided) for authz checks, or enumerate acceptable relations explicitly
> before calling.

### `documents(ctx, paginationOpts, filter?) → Page<MembershipDoc>`

One page of full membership docs —
`{ memberRef, memberKind, resourceRef, relation, status?, createdAt }` —
exposing the stored `createdAt` and `status`. `filter` optionally scopes by
`{ resourceRef }` or `{ memberRef }` (resource wins if both are given); unscoped
paginates every edge.

## React

Import from `@vllnt/convex-memberships/react`. `react` (`>=18`) is an optional
peer dependency; a backend-only consumer never loads this entry.

| Hook                                                              | Returns                                                   |
| ----------------------------------------------------------------- | --------------------------------------------------------- |
| `useIsMember(isMemberRef, { memberRef, resourceRef, relation? })` | `boolean \| undefined` (`undefined` while loading)        |
| `useMembers(membersRef, { memberRef })`                           | first `Page<ResourceEntry>`, or `undefined` while loading |
| `useListMembers(listMembersRef, { resourceRef, relation? })`      | first `Page<MemberEntry>`, or `undefined` while loading   |

Each `*Ref` argument is the host's re-exported query reference (`IsMemberRef`,
`MembersRef`, `ListMembersRef`). Without `relation`, `useIsMember` has the same
any-relation behavior as the unscoped `isMember` (see the warning above).

`useMembers` and `useListMembers` request only
`{ numItems: 100, cursor: null }`. They return the page object, including
`isDone` and `continueCursor`, but provide no load-more control. Use an
authorized host query with explicit pagination (or Convex's `usePaginatedQuery`)
when the first page is not enough.

All hooks consume host query references. The host must authorize the requested
member/resource; component isolation alone does not make metadata public.
`isMember` does not filter by `status`: apply any status-based policy in the
host.

## vNext

Transitive expansion (resolving a member of a group that is a member of an org
to a member of the org — `expandMembers` / `resolve`) is **not** in this
version. Edges are flat. It is planned for a future release.
