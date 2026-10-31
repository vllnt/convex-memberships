# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - Unreleased

### Fixed

- `add`, `remove` and `setRelation` reject an empty `memberRef`, `resourceRef`, `relation`,
  `memberKind`, `status`, `fromRelation` or `toRelation` with
  `ConvexError({ code: "INVALID_ARGUMENT" })`. Previously an empty relation or ref was stored as a
  real edge. Reactive queries still accept empty placeholder values and find nothing.
- `@vllnt/convex-memberships/test` now type-checks under `moduleResolution: nodenext` (explicit
  `.js` relative imports, Vite client types referenced).
- The published tarball no longer includes test files.

### Changed

- Adopt pnpm 10 with a release-age gate; releases are published only from CI with npm trusted
  publishing and provenance. Pin the deepmerge-ts override to 8.0.2.
- Document the error codes, that role/permission checks and last-owner protection are the host's
  job, and how to use `/test` in a consuming app.

## [0.1.0] - 2026-09-01

### Changed

- Treat Convex `_generated` output as CLI-owned, exclude it from formatting, and expose a
  dedicated codegen script.
- Require `convex@^1.45.0`.
- Bound all paginated membership reads to integer page sizes from 1 through 1000
  and cap `maximumRowsRead` at 1000 for reactive cursor ranges. Listing queries throw
  `INVALID_PAGE_SIZE` for invalid numeric pagination options.

### Fixed

- Skip redundant document patches when an idempotent `add` leaves classification and status unchanged.

### Added

- First release of `@vllnt/convex-memberships` — an auth-agnostic flat ReBAC
  relationship graph.
- Sandboxed `memberships` table holding `(memberRef, resourceRef, relation)`
  edges with an opaque, host-classified `memberKind` and an optional opaque
  `status` lifecycle marker.
- `Memberships` client: `add` (idempotent, patches `memberKind`/`status` on
  re-add), `remove` (returns `{ removed }`), `setRelation`, `listMembers`
  (paginated), `members` (paginated), `isMember` (bounded `by_member_resource`
  lookup), and `documents` (paginated doc view exposing `createdAt` + `status`).
- Configurable `defaultRelation` and `defaultMemberKind`.
- Indexes: `by_member`, `by_resource`, `by_resource_relation`,
  `by_member_resource`, `by_tuple`.

### Notes

- `memberKind` is an opaque `v.string()` (default `"user"`) — no closed union,
  so it makes no domain assumption.
- `add` is tuple-idempotent: if the exact `(memberRef, resourceRef, relation)`
  tuple already exists, the existing id is returned **and** `memberKind` /
  `status` are patched to the incoming values. Re-adding with a different
  `memberKind` updates the stored classification.
- `setRelation` checks whether the source `fromRelation` edge exists **before**
  applying the same-relation no-op. Calling `setRelation(m, r, "x", "x")` on a
  non-existent edge returns `{ ok: false, reason: "NOT_FOUND" }`, not
  `{ ok: true }`. The `{ ok: true }` no-op only fires when the edge exists and
  `fromRelation === toRelation`. `reason` is the typed union
  `"NOT_FOUND" | "EXISTS"`.
- **Security — unscoped `isMember`:** when called without `relation`, `isMember`
  returns `true` for **any** stored relation between the pair. Do not use the
  unscoped path as an authz gate without enumerating acceptable relations. The
  scoped path (`relation` provided) is safe for exact-relation authz checks.
- `MembersRef` / `ListMembersRef` hook-ref types are now typed with concrete
  `Page<ResourceEntry>` / `Page<MemberEntry>` return generics (previously
  `unknown`), giving hosts full type safety.
- Tuple reads use `.first()` so a stray duplicate row degrades gracefully rather
  than hard-throwing.
- Transitive expansion (`expandMembers` / `resolve`) is deferred to vNext; edges
  are flat.
