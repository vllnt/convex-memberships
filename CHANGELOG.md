# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-11-28

0.2.0 has two breaking changes for 0.1.0 users. They are why this release is a minor
bump: a `^0.1.0` range does not pull it in automatically.

### Breaking

- `add`, `remove` and `setRelation` reject an empty `memberRef`, `resourceRef`, `relation`,
  `memberKind`, `status`, `fromRelation` or `toRelation` with
  `ConvexError({ code: "INVALID_ARGUMENT" })`. 0.1.0 accepted these and stored the empty value
  as a real edge. Reactive queries still accept empty placeholder values and find nothing.
  **What to do:** never pass `""` to a write (including a `defaultRelation` or
  `defaultMemberKind` option). An edge stored with an empty `memberRef`, `resourceRef` or
  `relation` can no longer be removed or moved through `remove` or `setRelation`, so delete
  such edges while still on 0.1.0 (find them with `documents`).
- The `by_member`, `by_resource` and `by_member_resource` indexes are gone (see Changed), so
  pages are ordered differently. `members` and `documents` filtered by `memberRef` are ordered
  by resource, then relation, then insertion time. `listMembers` without `relation` and
  `documents` filtered by `resourceRef` are ordered by relation, then insertion time.
  `isMember` results and the set of rows returned do not change.
  **What to do:** do not rely on insertion order within those pages, and restart any
  pagination from `cursor: null` after the upgrade; do not reuse a cursor issued by 0.1.0.

### Added

- The npm tarball now ships `docs/*.md`, `CHANGELOG.md` and `llms.txt`, so the docs for the
  installed version are at `node_modules/@vllnt/convex-memberships/docs/`. `llms.txt` links the
  bundled files relatively. `pnpm test:package` (run in CI) fails when a required file is missing
  from the tarball, a contributor-only file is included, or the packed `/test` helper does not
  compile in a consumer project.
- `docs/API.md` lists the package entry points, the `useIsMember` hook, result ordering, and that
  `setRelation` rejects an empty `fromRelation` or `toRelation`.
- README: "For coding agents" and "Related packages" sections.

### Fixed

- An empty ref, relation, `memberKind` or `status` is no longer stored as a real edge (see
  Breaking).
- `@vllnt/convex-memberships/test` now type-checks under `moduleResolution: nodenext` (explicit
  `.js` relative imports, Vite client types referenced).
- The published tarball no longer includes test files.
- `register` from `@vllnt/convex-memberships/test` accepts a `convex-test` instance built from any
  host schema. It was typed to the component's own schema, so the documented `register(t)` failed
  to type-check when the host schema had tables.

### Changed

- Drop the prefix-duplicate `by_member`, `by_resource` and `by_member_resource` indexes. Their
  queries now use the `by_tuple` and `by_resource_relation` prefixes, so each write updates 2
  indexes instead of 5. The rows returned are unchanged; page order and old cursors are not (see
  Breaking).
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
