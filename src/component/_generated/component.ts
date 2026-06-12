/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    mutations: {
      add: FunctionReference<
        "mutation",
        "internal",
        {
          memberKind: string;
          memberRef: string;
          relation: string;
          resourceRef: string;
          status?: string;
        },
        string,
        Name
      >;
      remove: FunctionReference<
        "mutation",
        "internal",
        { memberRef: string; relation: string; resourceRef: string },
        { removed: boolean },
        Name
      >;
      setRelation: FunctionReference<
        "mutation",
        "internal",
        {
          fromRelation: string;
          memberRef: string;
          resourceRef: string;
          toRelation: string;
        },
        { ok: boolean; reason?: "NOT_FOUND" | "EXISTS" },
        Name
      >;
    };
    queries: {
      documents: FunctionReference<
        "query",
        "internal",
        {
          memberRef?: string;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          resourceRef?: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            createdAt: number;
            memberKind: string;
            memberRef: string;
            relation: string;
            resourceRef: string;
            status?: string;
          }>;
        },
        Name
      >;
      isMember: FunctionReference<
        "query",
        "internal",
        { memberRef: string; relation?: string; resourceRef: string },
        boolean,
        Name
      >;
      listMembers: FunctionReference<
        "query",
        "internal",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          relation?: string;
          resourceRef: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            memberKind: string;
            memberRef: string;
            relation: string;
          }>;
        },
        Name
      >;
      members: FunctionReference<
        "query",
        "internal",
        {
          memberRef: string;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{ relation: string; resourceRef: string }>;
        },
        Name
      >;
    };
  };
