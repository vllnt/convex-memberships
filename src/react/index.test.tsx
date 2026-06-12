// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

import { useQuery } from "convex/react";
import {
  useIsMember,
  useListMembers,
  useMembers,
  type IsMemberRef,
  type ListMembersRef,
  type MembersRef,
} from "./index";

const mockUseQuery = vi.mocked(useQuery);

const isMemberRef = "isMember" as unknown as IsMemberRef;
const membersRef = "members" as unknown as MembersRef;
const listMembersRef = "listMembers" as unknown as ListMembersRef;

describe("useIsMember", () => {
  it("forwards the ref and args verbatim and returns the loaded value", () => {
    mockUseQuery.mockReturnValue(true);
    const args = { memberRef: "user:1", resourceRef: "org:1", relation: "admin" };
    const { result } = renderHook(() => useIsMember(isMemberRef, args));
    expect(mockUseQuery).toHaveBeenCalledWith(isMemberRef, args);
    expect(result.current).toBe(true);
  });

  it("returns undefined while the query is loading", () => {
    mockUseQuery.mockReturnValue(undefined);
    const args = { memberRef: "user:2", resourceRef: "org:2" };
    const { result } = renderHook(() => useIsMember(isMemberRef, args));
    expect(mockUseQuery).toHaveBeenCalledWith(isMemberRef, args);
    expect(result.current).toBeUndefined();
  });
});

describe("useMembers", () => {
  it("requests the first page for the member and returns the loaded page", () => {
    const page = { page: [], isDone: true, continueCursor: "" };
    mockUseQuery.mockReturnValue(page);
    const { result } = renderHook(() => useMembers(membersRef, { memberRef: "user:1" }));
    expect(mockUseQuery).toHaveBeenCalledWith(membersRef, {
      memberRef: "user:1",
      paginationOpts: { numItems: 100, cursor: null },
    });
    expect(result.current).toBe(page);
  });

  it("returns undefined while the query is loading", () => {
    mockUseQuery.mockReturnValue(undefined);
    const { result } = renderHook(() => useMembers(membersRef, { memberRef: "user:2" }));
    expect(mockUseQuery).toHaveBeenCalledWith(membersRef, {
      memberRef: "user:2",
      paginationOpts: { numItems: 100, cursor: null },
    });
    expect(result.current).toBeUndefined();
  });
});

describe("useListMembers", () => {
  it("forwards the relation filter when provided and returns the loaded page", () => {
    const page = { page: [], isDone: true, continueCursor: "" };
    mockUseQuery.mockReturnValue(page);
    const { result } = renderHook(() =>
      useListMembers(listMembersRef, { resourceRef: "org:1", relation: "admin" }),
    );
    expect(mockUseQuery).toHaveBeenCalledWith(listMembersRef, {
      resourceRef: "org:1",
      relation: "admin",
      paginationOpts: { numItems: 100, cursor: null },
    });
    expect(result.current).toBe(page);
  });

  it("omits the relation (undefined) when not provided and returns undefined while loading", () => {
    mockUseQuery.mockReturnValue(undefined);
    const { result } = renderHook(() =>
      useListMembers(listMembersRef, { resourceRef: "org:2" }),
    );
    expect(mockUseQuery).toHaveBeenCalledWith(listMembersRef, {
      resourceRef: "org:2",
      relation: undefined,
      paginationOpts: { numItems: 100, cursor: null },
    });
    expect(result.current).toBeUndefined();
  });
});
