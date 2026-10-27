import { describe, expect, it, vi } from "vitest";
import { assertRole } from "@/server/auth/require-role";
import { ApiError } from "@/lib/api-error";
import type { DecodedSession } from "@/server/auth/jwt";

function makeSession(role: DecodedSession["role"]): DecodedSession {
  return {
    sub: "user-1",
    username: "testuser",
    role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900,
  };
}

describe("assertRole", () => {
  it("throws UNAUTHORIZED when session is null", () => {
    expect(() => assertRole(null)).toThrow(ApiError);
    try {
      assertRole(null);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).errorCode).toBe("UNAUTHORIZED");
    }
  });

  it("returns session when no allowedRoles restriction is given", () => {
    const session = makeSession("TECHNICIAN");
    expect(assertRole(session)).toBe(session);
  });

  it("returns session when role is in allowedRoles", () => {
    const session = makeSession("ADMIN");
    expect(assertRole(session, ["ADMIN", "MANAGER"])).toBe(session);
  });

  it("throws FORBIDDEN when role is not in allowedRoles", () => {
    const session = makeSession("TECHNICIAN");
    try {
      assertRole(session, ["ADMIN"]);
      throw new Error("expected assertRole to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).errorCode).toBe("FORBIDDEN");
    }
  });

  it("logs a warning when access is forbidden", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const session = makeSession("MANAGER");

    try {
      assertRole(session, ["ADMIN"]);
    } catch {
      // expected
    }

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("Forbidden access attempt");
    warnSpy.mockRestore();
  });

  // Role matrix ตาม Req 9.2-9.4: ADMIN เข้าได้ทุกที่ที่ระบุ ADMIN,
  // TECHNICIAN/MANAGER ถูกจำกัดตามที่ endpoint กำหนด
  describe("role matrix", () => {
    const cases: Array<{
      role: DecodedSession["role"];
      allowed: DecodedSession["role"][];
      shouldPass: boolean;
    }> = [
      { role: "ADMIN", allowed: ["ADMIN"], shouldPass: true },
      { role: "ADMIN", allowed: ["ADMIN", "MANAGER"], shouldPass: true },
      { role: "TECHNICIAN", allowed: ["ADMIN"], shouldPass: false },
      { role: "TECHNICIAN", allowed: ["TECHNICIAN"], shouldPass: true },
      { role: "MANAGER", allowed: ["ADMIN", "MANAGER"], shouldPass: true },
      { role: "MANAGER", allowed: ["TECHNICIAN"], shouldPass: false },
    ];

    for (const { role, allowed, shouldPass } of cases) {
      it(`role=${role} allowed=[${allowed.join(",")}] -> ${shouldPass ? "pass" : "forbidden"}`, () => {
        const session = makeSession(role);
        if (shouldPass) {
          expect(assertRole(session, allowed)).toBe(session);
        } else {
          expect(() => assertRole(session, allowed)).toThrow(ApiError);
        }
      });
    }
  });
});
