# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-06-12

### Added

- First release of `@vllnt/convex-memberships` — an auth-agnostic flat ReBAC
  relationship graph.
- Sandboxed `memberships` table holding `(memberRef, resourceRef, relation)`
  edges with an opaque, host-classified `memberKind` and an optional opaque
  `status` lifecycle marker.
- `Memberships` client: `add` (idempotent, takes optional `status`), `remove`
  (returns `{ removed }`), `setRelation`, `listMembers` (paginated), `members`
  (paginated), `isMember` (bounded `by_member_resource` lookup), and `documents`
  (paginated doc view exposing `createdAt` + `status`).
- Configurable `defaultRelation` and `defaultMemberKind`.
- Indexes: `by_member`, `by_resource`, `by_resource_relation`,
  `by_member_resource`, `by_tuple`.

### Notes

- `memberKind` is an opaque `v.string()` (default `"user"`) — no closed union,
  so it makes no domain assumption.
- `setRelation` is a no-op `{ ok: true }` when `fromRelation === toRelation`;
  its `reason` is the typed union `"NOT_FOUND" | "EXISTS"`.
- Tuple reads use `.first()` so a stray duplicate row degrades gracefully rather
  than hard-throwing.
- Transitive expansion (`expandMembers` / `resolve`) is deferred to vNext; edges
  are flat.
