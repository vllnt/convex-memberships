<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `example/convex/_generated/ai/guidelines.md` first** for
important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

`example/convex/_generated/ai/guidelines.md` is generated and git-ignored, so a fresh clone does not
have it. If it is missing, run `pnpm exec convex ai-files install` at the repository root (it reads
`convex.json`, needs network access but no login or deployment, and also installs agent skills via
`npx skills`), then delete the `CLAUDE.md` and `.claude/` it writes (`pnpm lint` fails while either
exists), undo its rewrap of the section above, and commit none of its output.

# @vllnt/convex-memberships

Auth-agnostic membership and relationship graph (ReBAC tuples), as a Convex component. Follows the
vllnt Component Standard (see the `oss-packages` hub `AGENTS.md`).

## Agent instructions

`AGENTS.md` is the sole agent-instruction source for this repository. Do not add
`CLAUDE.md` or `.claude` content.

## Architecture

```
src/
├── shared.ts              # shared types, validators, pure utils
├── test.ts                # convex-test register() helper
├── client/
│   ├── index.ts           # Memberships client class (consumer-facing API)
│   └── types.ts           # public TypeScript interfaces
├── react/
│   ├── index.tsx          # optional ./react entry — useIsMember, useMembers, useListMembers
│   └── index.test.tsx     # hook tests (jsdom)
└── component/
    ├── _generated/         # Convex codegen output (`pnpm codegen`), never edit
    ├── guards.ts           # requireNonEmpty() write-path argument guard
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
  `useQuery` over a host query that wraps the component and authorizes the caller. Never pass a
  plain re-export of a component query: the hook's args come from the client, so any client could
  read any member's or resource's edges. `react` is an optional peer dep — a backend-only
  consumer installs with zero React.

## Docs sync

| Changed | Update |
|---------|--------|
| API (client methods, args, returns) | `docs/API.md`, README API table, `llms.txt` |
| Error code or `setRelation` reason | README Errors and fixes table, `docs/API.md` Errors section, `llms.txt` |
| Limits, defaults, ordering | README Limits and gotchas, `docs/API.md`, `llms.txt` |
| Schema / indexes | `docs/API.md` Storage section, README Limits and gotchas (page order) |
| `./react` hooks added/changed | README API table, `docs/API.md` React section, `llms.txt` |
| Version bumped | `CHANGELOG.md`, README badges |
| `llms.txt` links changed | run `pnpm generate:llms` to check that local link targets exist (`llms.txt` is curated by hand) |

## Conventions

- Mutations in `mutations.ts`, queries in `queries.ts` (enforced by `@vllnt/eslint-config/convex`).
- Explicit `args` + `returns` on every Convex function.
- Host data via typed generics / host-supplied validator keyed by an opaque ref — never `v.any()` dumps.
- 100% test coverage is BLOCKING (`vitest.config.mts` thresholds).
- Runtime deps: only official `@convex-dev/*` + `@vllnt/*`.
- README, `llms.txt` and `docs/` follow the shared docs contract in
  `scripts/check-documentation.mjs`, run by `pnpm test:package` on the packed tarball. Every
  README `ts`/`tsx` example type-checks against the packed package; the Testing example also
  runs under Vitest.

## Generated code

- Every `**/_generated/**` file is owned exclusively by Convex CLI codegen.
- Never create, edit, lint, or format generated files manually.
- Run `pnpm codegen` to regenerate them and commit the generated output unchanged.
