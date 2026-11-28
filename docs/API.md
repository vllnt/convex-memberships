# API Reference — @vllnt/convex-memberships

**Compatibility:** `convex@^1.45.0`; React `>=18` (optional, `./react` only)

## Entry points

| Import                                                      | Exports                                                                                                                                                                                                   |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@vllnt/convex-memberships`                                 | `Memberships` class; types `MembershipsComponent`, `MembershipsOptions`, `MemberEntry`, `ResourceEntry`, `MembershipDoc`, `MemberKind`, `Page`, `PaginationOptions`, `RemoveResult`, `SetRelationResult`, `SetRelationReason` |
| `@vllnt/convex-memberships/react`                           | hooks `useIsMember`, `useMembers`, `useListMembers`; types `IsMemberRef`, `MembersRef`, `ListMembersRef`                                                                                                  |
| `@vllnt/convex-memberships/convex.config` (or `.js`)        | default component config for `app.use(...)`                                                                                                                                                               |
| `@vllnt/convex-memberships/test`                            | `register(t, name = "memberships")` for `convex-test` (TypeScript source; needs Vite `import.meta.glob`)                                                                                                  |
| `@vllnt/convex-memberships/_generated/component` (or `.js`) | type `ComponentApi`                                                                                                                                                                                       |

An edge is the tuple `(memberRef, resourceRef, relation)`, with an opaque
`memberKind` and an optional opaque `status`. All five are host strings the
component stores and compares but never interprets. Edges are flat: there is no
transitive expansion (see [vNext](#vnext)).

## Client

### `Memberships`

```ts
new Memberships(component: MembershipsComponent, options?: MembershipsOptions)
```

`component` is the mounted component, `components.memberships` (or the name
passed to `app.use`). `options.defaultRelation` (default `"member"`) is used
by `add` and `remove` when `relation` is omitted; `options.defaultMemberKind`
(default `"user"`) is used by `add` when `memberKind` is omitted. `listMembers`
and `isMember` treat an omitted `relation` as any relation. Mutations take a context with
`ctx.runMutation` (a mutation or action); queries take a context with
`ctx.runQuery` (a query, mutation or action).

The component performs no authentication or authorization and never reads
`ctx.auth`. The host authorizes every call, including who may grant or revoke
which relation, and protects the last owner of a resource (see the README
[Security](../README.md#security) section).

### `add`

```ts
add(ctx, memberRef: string, resourceRef: string, relation?: string, memberKind?: MemberKind, status?: string): Promise<string>
```

Adds the edge and returns its document id. `relation` defaults to
`defaultRelation`, `memberKind` to `defaultMemberKind`. Idempotent on the tuple
`(memberRef, resourceRef, relation)`: when the tuple exists, it returns the
existing id **and** sets `memberKind` and `status` to the incoming values
(omitting `status` clears a stored one). Nothing is written when both already
match. New edges get `createdAt = Date.now()`. Throws `INVALID_ARGUMENT` when
`memberRef`, `resourceRef`, `relation`, `memberKind` or `status` is `""`.

### `remove`

```ts
remove(ctx, memberRef: string, resourceRef: string, relation?: string): Promise<RemoveResult>
```

Deletes the edge. Returns `{ removed: true }` when an edge was deleted and
`{ removed: false }` when none existed. `relation` defaults to
`defaultRelation`. Throws `INVALID_ARGUMENT` for an empty `memberRef`,
`resourceRef` or `relation`.

### `setRelation`

```ts
setRelation(ctx, memberRef: string, resourceRef: string, fromRelation: string, toRelation: string): Promise<SetRelationResult>
```

Moves the member's `fromRelation` edge on the resource to `toRelation`, keeping
its id, `memberKind`, `status` and `createdAt`. In order:

1. No `fromRelation` edge: `{ ok: false, reason: "NOT_FOUND" }`, also when
   `fromRelation === toRelation`.
2. `fromRelation === toRelation`: `{ ok: true }`, nothing written.
3. A `toRelation` edge already exists: `{ ok: false, reason: "EXISTS" }`,
   nothing written.
4. Otherwise the relation is changed and the result is `{ ok: true }`.

Throws `INVALID_ARGUMENT` for an empty `memberRef`, `resourceRef`,
`fromRelation` or `toRelation`.

### `listMembers`

```ts
listMembers(ctx, resourceRef: string, paginationOpts: PaginationOptions, relation?: string): Promise<Page<MemberEntry>>
```

One page of the members of `resourceRef` as
`{ memberRef, memberKind, relation }`, narrowed to one `relation` when given.
Ordered by relation, then insertion time (index `by_resource_relation`); with
`relation`, by insertion time.

### `members`

```ts
members(ctx, memberRef: string, paginationOpts: PaginationOptions): Promise<Page<ResourceEntry>>
```

One page of the resources `memberRef` relates to, as `{ resourceRef, relation }`.
Ordered by resource, then relation, then insertion time (index `by_tuple`).

### `isMember`

```ts
isMember(ctx, memberRef: string, resourceRef: string, relation?: string): Promise<boolean>
```

With `relation`, whether that exact edge exists. Without it, whether **any**
relation connects the pair (one indexed lookup on the `by_tuple` prefix, not a
member scan). It does not look at `status`.

> **Security warning: unscoped path.** Without `relation` this returns `true`
> for any stored relation, including `"invited"`, `"suspended"` or `"banned"`.
> Do not use it as an authorization gate. Pass `relation`, or check each
> relation your policy accepts.

### `documents`

```ts
documents(ctx, paginationOpts: PaginationOptions, filter?: { resourceRef?: string; memberRef?: string }): Promise<Page<MembershipDoc>>
```

One page of full edges,
`{ memberRef, memberKind, resourceRef, relation, status?, createdAt }`. With
`filter.resourceRef` it pages that resource's edges, ordered by relation then
insertion time; `filter.memberRef` is ignored when `resourceRef` is also given.
With only `filter.memberRef` it pages that member's edges, ordered by resource,
relation, then insertion time. With no filter it pages every edge in the
component by insertion time.

### Pagination

`listMembers`, `members` and `documents` take a Convex `paginationOpts`
(`{ numItems, cursor }`) and return `{ page, isDone, continueCursor }`. Start
with `cursor: null`, then pass the returned `continueCursor` until `isDone` is
`true`.

- `numItems` must be an integer from 1 through 1000, otherwise
  `INVALID_PAGE_SIZE`.
- `maximumRowsRead`, when given, must be a positive finite integer, otherwise
  `INVALID_PAGE_SIZE`. It defaults to 1000, and larger values are lowered to
  1000, so explicit reactive cursor ranges stay bounded.
- Do not reuse a cursor issued by 0.1.0: the indexes changed, so restart from
  `cursor: null`.

### Empty strings

Mutations reject an empty string in any ref, relation, `memberKind` or `status`
with `INVALID_ARGUMENT`. Queries accept empty strings, so a UI can pass `""`
while an id loads; such a query finds nothing unless an edge with that empty
value was stored by 0.1.0, which accepted empty strings.

## Types

### `MembershipsComponent`

The type of `components.memberships`: `mutations` (`add`, `remove`,
`setRelation`) and `queries` (`listMembers`, `members`, `isMember`,
`documents`) as internal function references. The generated
[`ComponentApi`](#componentapi) has the same shape.

### `MembershipsOptions`

`{ defaultRelation?: string; defaultMemberKind?: MemberKind }`. Defaults
`"member"` (used by `add` and `remove`) and `"user"` (used by `add`). An empty value makes every write that uses it throw
`INVALID_ARGUMENT`.

### `MemberEntry`

`{ memberRef: string; memberKind: MemberKind; relation: string }`. A row of
`listMembers`.

### `ResourceEntry`

`{ resourceRef: string; relation: string }`. A row of `members`.

### `MembershipDoc`

`{ memberRef: string; memberKind: MemberKind; resourceRef: string; relation: string; status?: string; createdAt: number }`.
A row of `documents`. `createdAt` is epoch milliseconds of the first insert.

### `MemberKind`

`string`. An opaque, host-chosen classification of the member, for example
`"user"` or `"group"`.

### `Page`

`Page<T>` is `{ page: T[]; isDone: boolean; continueCursor: string }`, picked
from Convex `PaginationResult<T>`.

### `PaginationOptions`

Re-exported from `convex/server`: `{ numItems: number; cursor: string | null }`
plus Convex's optional fields such as `maximumRowsRead`. See
[Pagination](#pagination) for the bounds.

### `RemoveResult`

`{ removed: boolean }`.

### `SetRelationResult`

`{ ok: boolean; reason?: SetRelationReason }`. `reason` is set only when `ok` is
`false`.

### `SetRelationReason`

`"NOT_FOUND" | "EXISTS"`. See [`setRelation`](#setrelation).

## React

Import from `@vllnt/convex-memberships/react`. `react` (`>=18`) is an optional
peer dependency. Each hook calls `useQuery` from `convex/react` with a query
reference the host exports (for example `api.memberships.isMember`) and returns
`undefined` while it loads. The host query must authorize the requested member
and resource.

### `useIsMember`

```ts
useIsMember(isMemberRef: IsMemberRef, args: { memberRef: string; resourceRef: string; relation?: string }): boolean | undefined
```

Without `relation` it has the same any-relation behavior as
[`isMember`](#ismember).

### `useMembers`

```ts
useMembers(membersRef: MembersRef, args: { memberRef: string }): Page<ResourceEntry> | undefined
```

Requests `{ numItems: 100, cursor: null }`: the first page only, with no
load-more. Use a paginated host query (or Convex `usePaginatedQuery`) for more.

### `useListMembers`

```ts
useListMembers(listMembersRef: ListMembersRef, args: { resourceRef: string; relation?: string }): Page<MemberEntry> | undefined
```

Requests `{ numItems: 100, cursor: null }`: the first page only, with no
load-more.

### `IsMemberRef`

`FunctionReference<"query", "public", { memberRef: string; resourceRef: string; relation?: string }, boolean>`.

### `MembersRef`

`FunctionReference<"query", "public", { memberRef: string; paginationOpts: { numItems: number; cursor: string | null } }, Page<ResourceEntry>>`.

### `ListMembersRef`

`FunctionReference<"query", "public", { resourceRef: string; relation?: string; paginationOpts: { numItems: number; cursor: string | null } }, Page<MemberEntry>>`.

## Other entry points

### `convex.config`

The default export of `@vllnt/convex-memberships/convex.config` is the
component definition (`defineComponent("memberships")`). Mount it with
`app.use(memberships)`, or `app.use(memberships, { name })` for several
isolated mounts.

### `register`

```ts
register<TSchema extends GenericSchema>(t: TestConvex<SchemaDefinition<TSchema, boolean>>, name = "memberships"): void
```

From `@vllnt/convex-memberships/test`. Mounts the component in a `convex-test`
instance built from any host schema, under `name` (default `"memberships"`).
Shipped as TypeScript source that uses Vite's `import.meta.glob`, so run it
under Vitest.

### `ComponentApi`

From `@vllnt/convex-memberships/_generated/component`. The Convex-generated
type of the mounted component (types only).

## Errors

Invalid input throws a `ConvexError` whose `data` is `{ code, message }`:

- `INVALID_ARGUMENT` from `add`, `remove` and `setRelation`: an empty string
  argument. Message `<field> must not be empty`.
- `INVALID_PAGE_SIZE` from `listMembers`, `members` and `documents`: a
  `numItems` or `maximumRowsRead` outside the bounds under
  [Pagination](#pagination).

`setRelation` returns `reason` `NOT_FOUND` or `EXISTS` instead of throwing.
Causes and fixes are in the README's
[Errors and fixes](../README.md#errors-and-fixes) table.

## Storage

One sandboxed table, `memberships`:
`{ memberRef, memberKind, resourceRef, relation, status?, createdAt }`, with
the indexes `by_resource_relation` (`resourceRef`, `relation`) and `by_tuple`
(`memberRef`, `resourceRef`, `relation`). The host reaches it only through the
component's functions.

## vNext

Transitive expansion (resolving a member of a group that is a member of an org
as a member of the org) is not in this version. Edges are flat.
