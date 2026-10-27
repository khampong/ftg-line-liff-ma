import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLineFriendshipStatus,
  getLineProfile,
  verifyLineAccessToken,
} from "@/server/line/client";
import { ApiError } from "@/lib/api-error";

// env.LINE_CHANNEL_ID ที่ตั้งใน vitest.config.mts ต้องตรงกับค่านี้เพื่อทดสอบ client_id check
const EXPECTED_CHANNEL_ID = "test-line-channel-id";

function mockFetchOnce(response: { ok: boolean; json: () => Promise<unknown> }) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValueOnce({
      ok: response.ok,
      json: response.json,
    }),
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("verifyLineAccessToken", () => {
  it("resolves when token is valid and client_id matches our channel", async () => {
    mockFetchOnce({
      ok: true,
      json: async () => ({
        client_id: EXPECTED_CHANNEL_ID,
        expires_in: 2592000,
        scope: "profile openid",
      }),
    });

    const result = await verifyLineAccessToken("valid-token");
    expect(result.clientId).toBe(EXPECTED_CHANNEL_ID);
    expect(result.expiresIn).toBe(2592000);
  });

  it("throws UNAUTHORIZED when LINE responds with non-ok status (expired/invalid token)", async () => {
    mockFetchOnce({ ok: false, json: async () => ({ error: "invalid_request" }) });

    await expect(verifyLineAccessToken("bad-token")).rejects.toMatchObject({
      errorCode: "UNAUTHORIZED",
    });
  });

  it("throws UNAUTHORIZED when token was issued for a different channel", async () => {
    mockFetchOnce({
      ok: true,
      json: async () => ({
        client_id: "some-other-channel-id",
        expires_in: 2592000,
        scope: "profile openid",
      }),
    });

    await expect(verifyLineAccessToken("token-for-other-channel")).rejects.toMatchObject({
      errorCode: "UNAUTHORIZED",
    });
  });
});

describe("getLineProfile", () => {
  it("returns profile data on success", async () => {
    mockFetchOnce({
      ok: true,
      json: async () => ({
        userId: "U1234567890",
        displayName: "ทดสอบ ผู้ใช้",
        pictureUrl: "https://profile.line-scdn.net/abc",
      }),
    });

    const profile = await getLineProfile("valid-token");
    expect(profile.userId).toBe("U1234567890");
    expect(profile.displayName).toBe("ทดสอบ ผู้ใช้");
  });

  it("throws UNAUTHORIZED when LINE responds with non-ok status", async () => {
    mockFetchOnce({ ok: false, json: async () => ({}) });

    await expect(getLineProfile("bad-token")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("getLineFriendshipStatus", () => {
  it("returns friendFlag=true when user is a friend", async () => {
    mockFetchOnce({ ok: true, json: async () => ({ friendFlag: true }) });

    const status = await getLineFriendshipStatus("valid-token");
    expect(status.friendFlag).toBe(true);
  });

  it("returns friendFlag=false when user is not a friend", async () => {
    mockFetchOnce({ ok: true, json: async () => ({ friendFlag: false }) });

    const status = await getLineFriendshipStatus("valid-token");
    expect(status.friendFlag).toBe(false);
  });

  it("throws UNAUTHORIZED when LINE responds with non-ok status", async () => {
    mockFetchOnce({ ok: false, json: async () => ({}) });

    await expect(getLineFriendshipStatus("bad-token")).rejects.toBeInstanceOf(ApiError);
  });
});
