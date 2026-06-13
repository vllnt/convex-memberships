# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-06-13

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
