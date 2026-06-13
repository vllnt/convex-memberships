# API Reference — @vllnt/convex-memberships

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
(`{ numItems, cursor }`) and return `{ page, isDone, continueCursor }`. Feed the
returned `continueCursor` back as the next call's `cursor`; `isDone` is true on
the last page.

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
> `{ ok: false, reason: "NOT_FOUND" }`, not `{ ok: true }`. The no-op only
> fires when the source edge is confirmed to exist.

## Queries

### `listMembers(ctx, resourceRef, paginationOpts, relation?) → Page<MemberEntry>`

One page of members of `resourceRef` as `{ memberRef, memberKind, relation }`.
Filtered to a single `relation` when given.

### `members(ctx, memberRef, paginationOpts) → Page<ResourceEntry>`

One page of resources `memberRef` relates to, as `{ resourceRef, relation }`.

### `isMember(ctx, memberRef, resourceRef, relation?) → boolean`

Whether `memberRef` relates to `resourceRef`. With `relation`, checks that exact
edge; without, a bounded `by_member_resource` index lookup checks whether any
relation connects the two (not a full member scan).

> **Security warning — unscoped path.** When `relation` is omitted, this method
> returns `true` for **any** relation stored between the pair (e.g. `"invited"`,
> `"suspended"`, `"banned"`). Do **not** use the unscoped path as an
> authorization gate without first enumerating every relation your policy
> considers sufficient for the guarded action. Use the scoped path (`relation`
> provided) for authz checks, or enumerate acceptable relations explicitly before
> calling.

### `documents(ctx, paginationOpts, filter?) → Page<MembershipDoc>`

One page of full membership docs — `{ memberRef, memberKind, resourceRef,
relation, status?, createdAt }` — exposing the stored `createdAt` and `status`.
`filter` optionally scopes by `{ resourceRef }` or `{ memberRef }` (resource
wins if both are given); unscoped paginates every edge.

## vNext

Transitive expansion (resolving a member of a group that is a member of an org
to a member of the org — `expandMembers` / `resolve`) is **not** in this version.
Edges are flat. It is planned for a future release.
