import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
  PaginationOptions,
} from "convex/server";
import type {
  MemberEntry,
  MemberKind,
  MembershipDoc,
  MembershipsOptions,
  Page,
  RemoveResult,
  ResourceEntry,
  SetRelationResult,
} from "./types.js";
import { DEFAULT_MEMBER_KIND, DEFAULT_RELATION } from "../shared.js";

/**
 * The memberships component's function references, as exposed on the host via
 * `components.memberships`.
 */
export interface MembershipsComponent {
  mutations: {
    add: FunctionReference<
      "mutation",
      "internal",
      {
        memberRef: string;
        memberKind: MemberKind;
        resourceRef: string;
        relation: string;
        status?: string;
      },
      string
    >;
    remove: FunctionReference<
      "mutation",
      "internal",
      { memberRef: string; resourceRef: string; relation: string },
      RemoveResult
    >;
    setRelation: FunctionReference<
      "mutation",
      "internal",
      {
        memberRef: string;
        resourceRef: string;
        fromRelation: string;
        toRelation: string;
      },
      SetRelationResult
    >;
  };
  queries: {
    listMembers: FunctionReference<
      "query",
      "internal",
      {
        resourceRef: string;
        relation?: string;
        paginationOpts: PaginationOptions;
      },
      Page<MemberEntry>
    >;
    members: FunctionReference<
      "query",
      "internal",
      { memberRef: string; paginationOpts: PaginationOptions },
      Page<ResourceEntry>
    >;
    isMember: FunctionReference<
      "query",
      "internal",
      { memberRef: string; resourceRef: string; relation?: string },
      boolean
    >;
    documents: FunctionReference<
      "query",
      "internal",
      {
        resourceRef?: string;
        memberRef?: string;
        paginationOpts: PaginationOptions;
      },
      Page<MembershipDoc>
    >;
  };
}

interface RunQueryCtx {
  runQuery<Q extends FunctionReference<"query", "internal">>(
    reference: Q,
    args: FunctionArgs<Q>,
  ): Promise<FunctionReturnType<Q>>;
}

interface RunMutationCtx {
  runMutation<M extends FunctionReference<"mutation", "internal">>(
    reference: M,
    args: FunctionArgs<M>,
  ): Promise<FunctionReturnType<M>>;
}

/**
 * Consumer-facing client for the flat ReBAC relationship graph. The host owns
 * identity, the rich entity, and auth; it passes opaque `memberRef` /
 * `resourceRef` strings and an optional `relation` into the client.
 */
export class Memberships {
  private readonly defaultRelation: string;
  private readonly defaultMemberKind: MemberKind;

  constructor(
    private readonly component: MembershipsComponent,
    options: MembershipsOptions = {},
  ) {
    this.defaultRelation = options.defaultRelation ?? DEFAULT_RELATION;
    this.defaultMemberKind = options.defaultMemberKind ?? DEFAULT_MEMBER_KIND;
  }

  private relationOf(relation: string | undefined): string {
    return relation ?? this.defaultRelation;
  }

  private kindOf(kind: MemberKind | undefined): MemberKind {
    return kind ?? this.defaultMemberKind;
  }

  /**
   * Add the edge `(memberRef, resourceRef, relation)`, classified by
   * `memberKind` and optionally stamped with an opaque `status`. Idempotent —
   * returns the existing id if the exact tuple is already held.
   */
  add(
    ctx: RunMutationCtx,
    memberRef: string,
    resourceRef: string,
    relation?: string,
    memberKind?: MemberKind,
    status?: string,
  ): Promise<string> {
    return ctx.runMutation(this.component.mutations.add, {
      memberRef,
      memberKind: this.kindOf(memberKind),
      resourceRef,
      relation: this.relationOf(relation),
      status,
    });
  }

  /**
   * Remove the edge `(memberRef, resourceRef, relation)`. Idempotent — returns
   * `{ removed: false }` when the edge was absent, `{ removed: true }` otherwise.
   */
  remove(
    ctx: RunMutationCtx,
    memberRef: string,
    resourceRef: string,
    relation?: string,
  ): Promise<RemoveResult> {
    return ctx.runMutation(this.component.mutations.remove, {
      memberRef,
      resourceRef,
      relation: this.relationOf(relation),
    });
  }

  /** Change a member's relation on a resource from `fromRelation` to `toRelation`. */
  setRelation(
    ctx: RunMutationCtx,
    memberRef: string,
    resourceRef: string,
    fromRelation: string,
    toRelation: string,
  ): Promise<SetRelationResult> {
    return ctx.runMutation(this.component.mutations.setRelation, {
      memberRef,
      resourceRef,
      fromRelation,
      toRelation,
    });
  }

  /**
   * One page of members of `resourceRef`, optionally filtered to a single
   * `relation`. Pass `paginationOpts` (`{ numItems, cursor }`); feed the
   * returned `continueCursor` back to load the next page.
   */
  listMembers(
    ctx: RunQueryCtx,
    resourceRef: string,
    paginationOpts: PaginationOptions,
    relation?: string,
  ): Promise<Page<MemberEntry>> {
    return ctx.runQuery(this.component.queries.listMembers, {
      resourceRef,
      relation,
      paginationOpts,
    });
  }

  /** One page of resources that `memberRef` relates to, with each relation. */
  members(
    ctx: RunQueryCtx,
    memberRef: string,
    paginationOpts: PaginationOptions,
  ): Promise<Page<ResourceEntry>> {
    return ctx.runQuery(this.component.queries.members, {
      memberRef,
      paginationOpts,
    });
  }

  /**
   * Whether `memberRef` relates to `resourceRef`. With `relation`, checks that
   * exact edge; without, checks any relation between the two.
   *
   * @remarks
   * **Security warning — unscoped path.** When `relation` is omitted this
   * method returns `true` for **any** relation stored between the pair
   * (e.g. `"invited"`, `"suspended"`, `"banned"`). Do **not** use the
   * unscoped path as an authorization gate without first enumerating every
   * relation your policy considers sufficient for the guarded action. Use the
   * scoped path (`relation` provided) for authz checks, or enumerate
   * acceptable relations explicitly before calling.
   */
  isMember(
    ctx: RunQueryCtx,
    memberRef: string,
    resourceRef: string,
    relation?: string,
  ): Promise<boolean> {
    return ctx.runQuery(this.component.queries.isMember, {
      memberRef,
      resourceRef,
      relation,
    });
  }

  /**
   * One page of full membership docs (`memberRef`, `memberKind`, `resourceRef`,
   * `relation`, `status?`, `createdAt`). Optionally scoped by `resourceRef` or
   * `memberRef` (resource wins if both are given); unscoped paginates all edges.
   */
  documents(
    ctx: RunQueryCtx,
    paginationOpts: PaginationOptions,
    filter: { resourceRef?: string; memberRef?: string } = {},
  ): Promise<Page<MembershipDoc>> {
    return ctx.runQuery(this.component.queries.documents, {
      resourceRef: filter.resourceRef,
      memberRef: filter.memberRef,
      paginationOpts,
    });
  }
}

export type {
  MemberEntry,
  MemberKind,
  MembershipDoc,
  MembershipsOptions,
  Page,
  PaginationOptions,
  RemoveResult,
  ResourceEntry,
  SetRelationReason,
  SetRelationResult,
} from "./types.js";
