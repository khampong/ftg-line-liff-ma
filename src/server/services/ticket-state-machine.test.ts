import { describe, expect, it } from "vitest";
import {
  assertTransition,
  getTimestampFieldForStatus,
} from "@/server/services/ticket-state-machine";
import { ApiError } from "@/lib/api-error";
import type { TicketStatus, UserRole } from "@prisma/client";

function ctx(overrides: {
  fromStatus: TicketStatus;
  toStatus: TicketStatus;
  actorRole?: UserRole;
  hasAssignee?: boolean;
  hasRepairNote?: boolean;
}) {
  return {
    actorRole: "ADMIN" as UserRole,
    hasAssignee: true,
    hasRepairNote: true,
    ...overrides,
  };
}

describe("assertTransition — valid transitions", () => {
  it("allows NEW -> ACCEPTED when assignee is set (Admin)", () => {
    expect(() =>
      assertTransition(ctx({ fromStatus: "NEW", toStatus: "ACCEPTED", hasAssignee: true })),
    ).not.toThrow();
  });

  it("allows ACCEPTED -> IN_PROGRESS by Technician", () => {
    expect(() =>
      assertTransition(
        ctx({ fromStatus: "ACCEPTED", toStatus: "IN_PROGRESS", actorRole: "TECHNICIAN" }),
      ),
    ).not.toThrow();
  });

  it("allows IN_PROGRESS -> REPAIRED by Technician when repairNote is set", () => {
    expect(() =>
      assertTransition(
        ctx({
          fromStatus: "IN_PROGRESS",
          toStatus: "REPAIRED",
          actorRole: "TECHNICIAN",
          hasRepairNote: true,
        }),
      ),
    ).not.toThrow();
  });

  it("allows REPAIRED -> CLOSED by Admin", () => {
    expect(() =>
      assertTransition(ctx({ fromStatus: "REPAIRED", toStatus: "CLOSED", actorRole: "ADMIN" })),
    ).not.toThrow();
  });

  it("allows CLOSED -> ACCEPTED (reopen) by Admin", () => {
    expect(() =>
      assertTransition(ctx({ fromStatus: "CLOSED", toStatus: "ACCEPTED", actorRole: "ADMIN" })),
    ).not.toThrow();
  });

  it("allows NEW/ACCEPTED/IN_PROGRESS -> CANCELLED by Admin", () => {
    for (const from of ["NEW", "ACCEPTED", "IN_PROGRESS"] as TicketStatus[]) {
      expect(() =>
        assertTransition(ctx({ fromStatus: from, toStatus: "CANCELLED", actorRole: "ADMIN" })),
      ).not.toThrow();
    }
  });
});

describe("assertTransition — invalid state machine transitions (Req 7.4)", () => {
  it("rejects skipping states, e.g. NEW -> REPAIRED", () => {
    expect(() => assertTransition(ctx({ fromStatus: "NEW", toStatus: "REPAIRED" }))).toThrow(
      ApiError,
    );
  });

  it("rejects NEW -> IN_PROGRESS (must go through ACCEPTED)", () => {
    expect(() => assertTransition(ctx({ fromStatus: "NEW", toStatus: "IN_PROGRESS" }))).toThrow(
      ApiError,
    );
  });

  it("rejects moving backwards, e.g. IN_PROGRESS -> ACCEPTED", () => {
    expect(() =>
      assertTransition(ctx({ fromStatus: "IN_PROGRESS", toStatus: "ACCEPTED" })),
    ).toThrow(ApiError);
  });

  it("rejects any transition out of CANCELLED (terminal state)", () => {
    for (const to of ["NEW", "ACCEPTED", "IN_PROGRESS", "REPAIRED", "CLOSED"] as TicketStatus[]) {
      expect(() => assertTransition(ctx({ fromStatus: "CANCELLED", toStatus: to }))).toThrow(
        ApiError,
      );
    }
  });

  it("rejects CLOSED -> CANCELLED (closed tickets cannot be cancelled)", () => {
    expect(() => assertTransition(ctx({ fromStatus: "CLOSED", toStatus: "CANCELLED" }))).toThrow(
      ApiError,
    );
  });

  it("throws with errorCode INVALID_TRANSITION for state machine violations", () => {
    try {
      assertTransition(ctx({ fromStatus: "NEW", toStatus: "REPAIRED" }));
      throw new Error("expected to throw");
    } catch (error) {
      expect((error as ApiError).errorCode).toBe("INVALID_TRANSITION");
    }
  });
});

describe("assertTransition — business rule guards", () => {
  it("rejects NEW -> ACCEPTED without an assignee (Req 6.4)", () => {
    expect(() =>
      assertTransition(ctx({ fromStatus: "NEW", toStatus: "ACCEPTED", hasAssignee: false })),
    ).toThrow(ApiError);
  });

  it("rejects IN_PROGRESS -> REPAIRED without a repair note (Req 7.3)", () => {
    expect(() =>
      assertTransition(
        ctx({ fromStatus: "IN_PROGRESS", toStatus: "REPAIRED", hasRepairNote: false }),
      ),
    ).toThrow(ApiError);
  });
});

describe("assertTransition — role-based restrictions", () => {
  it("only Admin can close a ticket (Req 8.1)", () => {
    expect(() =>
      assertTransition(
        ctx({ fromStatus: "REPAIRED", toStatus: "CLOSED", actorRole: "TECHNICIAN" }),
      ),
    ).toThrow(ApiError);
    expect(() =>
      assertTransition(ctx({ fromStatus: "REPAIRED", toStatus: "CLOSED", actorRole: "ADMIN" })),
    ).not.toThrow();
  });

  it("only Admin can reopen a closed ticket", () => {
    expect(() =>
      assertTransition(
        ctx({ fromStatus: "CLOSED", toStatus: "ACCEPTED", actorRole: "TECHNICIAN" }),
      ),
    ).toThrow(ApiError);
  });

  it("technician cannot skip directly to states outside their allowed set", () => {
    expect(() =>
      assertTransition(ctx({ fromStatus: "NEW", toStatus: "ACCEPTED", actorRole: "TECHNICIAN" })),
    ).toThrow(ApiError);
  });

  it("technician cannot cancel a ticket", () => {
    expect(() =>
      assertTransition(ctx({ fromStatus: "NEW", toStatus: "CANCELLED", actorRole: "TECHNICIAN" })),
    ).toThrow(ApiError);
  });

  it("manager cannot change status at all (read-only role)", () => {
    expect(() =>
      assertTransition(
        ctx({ fromStatus: "ACCEPTED", toStatus: "IN_PROGRESS", actorRole: "MANAGER" }),
      ),
    ).toThrow(ApiError);
  });
});

describe("getTimestampFieldForStatus", () => {
  it("maps ACCEPTED/REPAIRED/CLOSED to their timestamp fields", () => {
    expect(getTimestampFieldForStatus("ACCEPTED")).toBe("acceptedAt");
    expect(getTimestampFieldForStatus("REPAIRED")).toBe("repairedAt");
    expect(getTimestampFieldForStatus("CLOSED")).toBe("closedAt");
  });

  it("returns null for statuses without a dedicated timestamp", () => {
    expect(getTimestampFieldForStatus("NEW")).toBeNull();
    expect(getTimestampFieldForStatus("IN_PROGRESS")).toBeNull();
    expect(getTimestampFieldForStatus("CANCELLED")).toBeNull();
  });
});
