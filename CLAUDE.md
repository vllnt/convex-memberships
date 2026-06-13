<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `example/convex/_generated/ai/guidelines.md` first** for
important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

# @vllnt/convex-memberships

Auth-agnostic membership and relationship graph (ReBAC tuples), as a Convex component. Follows the
vllnt Component Standard (see the `convex-components` hub `.claude/rules/component-standard.md`).

## Architecture

```
src/
├── shared.ts              # shared types, validators, pure utils
├── test.ts                # convex-test register() helper
├── client/
│   ├── index.ts           # Memberships client class (consumer-facing API)
│   └── types.ts           # public TypeScript interfaces
├── react/
│   └── index.tsx          # optional ./react entry — useIsMember, useMembers, useListMembers
└── component/
    ├── mutations.ts        # all mutations
    ├── queries.ts          # all queries
    ├── validators.ts       # shared validators
    ├── schema.ts           # sandboxed tables
    └── convex.config.ts    # defineComponent("memberships")
```

## Ownership boundary

| Concern | Owner |
|---------|-------|
| Relationship edges `(memberRef, resourceRef, relation)` | **Component** — sandboxed `memberships` table |
| `memberKind` / `status` opaque classification | **Component** stores; **host** assigns meaning |
| Identity, auth, and rich entity | **Host** — component never resolves refs |
| Authorization decisions | **Host** — component exposes data; host enforces policy |

The component is **auth-agnostic**: it never authenticates or authorizes. The host resolves
identity, decides whether a caller may create or read an edge, and passes opaque strings in. The
sandboxed table is unreachable by the host except through the component's exported functions.

## Key design decisions

- **Flat ReBAC tuple graph.** Edges are `(memberRef, resourceRef, relation)`. No transitive
  expansion in 0.1.0 — a member of a group that is a member of an org is NOT auto-resolved to
  a member of the org. `expandMembers` / `resolve` is vNext.
- **`add` is tuple-idempotent and patches.** If the exact tuple `(memberRef, resourceRef,
  relation)` already exists, the existing id is returned **and** `memberKind` / `status` are
  patched to the incoming values. Re-adding with a different `memberKind` updates the stored
  classification without creating a duplicate edge.
- **`setRelation` requires the source edge to exist.** `setRelation(m, r, "x", "x")` on a
  non-existent edge returns `{ ok: false, reason: "NOT_FOUND" }`, not a silent no-op. The
  same-relation no-op `{ ok: true }` fires only when the source edge is confirmed to exist.
- **Unscoped `isMember` is an authz footgun.** When called without `relation`, `isMember` returns
  `true` for **any** relation stored between the pair (e.g. `"invited"`, `"suspended"`,
  `"banned"`). Do not use the unscoped path as an authorization gate without first enumerating
  every relation your policy considers sufficient for the guarded action.
- **Opaque refs throughout.** `memberRef`, `resourceRef`, `relation`, `memberKind`, and `status`
  are arbitrary host strings. The component never inspects, de-references, or validates their shape.
- **Optional `./react` entry.** Thin hooks (`useIsMember`, `useMembers`, `useListMembers`) wrap
  `useQuery` over the host's re-exported function refs. `react` is an optional peer dep — a
  backend-only consumer installs with zero React. No secrets reach the client; only membership
  metadata derived from the caller's own refs.

## Docs sync

| Changed | Update |
|---------|--------|
| API (client methods, args, returns) | `docs/API.md`, README API Reference table, `llms.txt` + `llms-full.txt` |
| Schema / indexes | README Architecture section, `docs/API.md` |
| `./react` hooks added/changed | README React section, `scripts/generate-llms.mjs` file list, `llms-full.txt` |
| Version bumped | `CHANGELOG.md`, README badges |
| Any source change | run `pnpm generate:llms` to regenerate `llms-full.txt` |

## Conventions

- Mutations in `mutations.ts`, queries in `queries.ts` (enforced by `@vllnt/eslint-config/convex`).
- Explicit `args` + `returns` on every Convex function.
- Host data via typed generics / host-supplied validator keyed by an opaque ref — never `v.any()` dumps.
- 100% test coverage is BLOCKING (`vitest.config.mts` thresholds).
- Runtime deps: only official `@convex-dev/*` + `@vllnt/*`.
