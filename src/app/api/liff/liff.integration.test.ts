import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { rm } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/server/db";
import { resetRateLimitStore } from "@/server/services/rate-limit";

/**
 * Integration test สำหรับ endpoint ฝั่ง LIFF (Task 10)
 * ใช้ DB จริง (dev postgres ผ่าน vitest.integration.config.mts) + mock เฉพาะ LINE API
 * รัน: npm run test:integration (ต้อง docker compose up postgres ก่อน)
 */

vi.mock("@/server/line/auth", () => ({
  authenticateLineUser: vi.fn(),
}));

import { authenticateLineUser } from "@/server/line/auth";
import { GET as getAssetByToken } from "@/app/api/liff/assets/[token]/route";
import { POST as createTicket } from "@/app/api/liff/tickets/route";

const mockedAuthenticateLineUser = authenticateLineUser as unknown as ReturnType<typeof vi.fn>;

const TEST_LINE_USER_ID = "Uintegrationtest0001";
const TEST_ASSET_CODE = "INT-TEST-0001";
const TEST_TOKEN = "integration-test-token-0001";
const REVOKED_TOKEN = "integration-test-token-revoked";

let testAssetId: string;
let testCustomerId: string;

function mockFriend() {
  mockedAuthenticateLineUser.mockResolvedValue({
    profile: {
      userId: TEST_LINE_USER_ID,
      displayName: "ผู้ใช้ทดสอบ",
      pictureUrl: "https://example.com/pic.jpg",
    },
    isFriend: true,
  });
}

function mockNotFriend() {
  mockedAuthenticateLineUser.mockResolvedValue({
    profile: { userId: TEST_LINE_USER_ID, displayName: "ผู้ใช้ทดสอบ" },
    isFriend: false,
  });
}

beforeAll(async () => {
  const customer = await prisma.customer.create({
    data: { name: "ลูกค้าทดสอบ integration", location: "คลังทดสอบ" },
  });
  testCustomerId = customer.id;

  const asset = await prisma.asset.create({
    data: {
      customerId: customer.id,
      assetCode: TEST_ASSET_CODE,
      model: "Test Forklift",
      location: "โซนทดสอบ",
    },
  });
  testAssetId = asset.id;

  await prisma.assetQrToken.create({
    data: { assetId: asset.id, token: TEST_TOKEN },
  });
  await prisma.assetQrToken.create({
    data: { assetId: asset.id, token: REVOKED_TOKEN, active: false, revokedAt: new Date() },
  });
});

afterAll(async () => {
  await prisma.ticketHistory.deleteMany({ where: { ticket: { assetId: testAssetId } } });
  await prisma.ticketAttachment.deleteMany({ where: { ticket: { assetId: testAssetId } } });
  await prisma.ticket.deleteMany({ where: { assetId: testAssetId } });
  await prisma.assetQrToken.deleteMany({ where: { assetId: testAssetId } });
  await prisma.asset.delete({ where: { id: testAssetId } });
  await prisma.customer.delete({ where: { id: testCustomerId } });
  await prisma.$disconnect();
  await rm(path.join(process.cwd(), ".vitest-integration-uploads-tmp"), {
    recursive: true,
    force: true,
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimitStore();
});

describe("GET /api/liff/assets/[token]", () => {
  it("returns asset context when token valid and user is a friend", async () => {
    mockFriend();
    const req = new NextRequest(`http://localhost/api/liff/assets/${TEST_TOKEN}`, {
      headers: { authorization: "Bearer fake-line-token" },
    });

    const res = await getAssetByToken(req, { params: Promise.resolve({ token: TEST_TOKEN }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.asset.assetCode).toBe(TEST_ASSET_CODE);
    expect(body.customer.name).toBe("ลูกค้าทดสอบ integration");
    expect(body.reporter.lineUserId).toBe(TEST_LINE_USER_ID);
  });

  it("returns 403 NOT_FRIEND when user has not added the OA as friend (Req 1.2)", async () => {
    mockNotFriend();
    const req = new NextRequest(`http://localhost/api/liff/assets/${TEST_TOKEN}`, {
      headers: { authorization: "Bearer fake-line-token" },
    });

    const res = await getAssetByToken(req, { params: Promise.resolve({ token: TEST_TOKEN }) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.errorCode).toBe("NOT_FRIEND");
  });

  it("returns 404 QR_REVOKED when token has been rotated/revoked (Req 5.5)", async () => {
    mockFriend();
    const req = new NextRequest(`http://localhost/api/liff/assets/${REVOKED_TOKEN}`, {
      headers: { authorization: "Bearer fake-line-token" },
    });

    const res = await getAssetByToken(req, { params: Promise.resolve({ token: REVOKED_TOKEN }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.errorCode).toBe("QR_REVOKED");
  });

  it("returns 404 INVALID_QR when token does not exist (Req 2.3)", async () => {
    mockFriend();
    const req = new NextRequest("http://localhost/api/liff/assets/does-not-exist", {
      headers: { authorization: "Bearer fake-line-token" },
    });

    const res = await getAssetByToken(req, {
      params: Promise.resolve({ token: "does-not-exist" }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.errorCode).toBe("INVALID_QR");
  });
});

describe("POST /api/liff/tickets", () => {
  it("creates a ticket with a single symptom category and no attachments (Req 3.5, 3.6)", async () => {
    mockFriend();
    const formData = new FormData();
    formData.set("assetToken", TEST_TOKEN);
    formData.append("symptomCategories", "ENGINE_NO_START");

    const req = new NextRequest("http://localhost/api/liff/tickets", {
      method: "POST",
      headers: { authorization: "Bearer fake-line-token" },
      body: formData,
    });

    const res = await createTicket(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ticket.ticketNo).toMatch(/^T-\d{8}-\d{4}$/);

    const ticket = await prisma.ticket.findUnique({
      where: { id: body.ticket.id },
      include: { history: true },
    });
    expect(ticket?.status).toBe("NEW");
    expect(ticket?.lineUserId).toBe(TEST_LINE_USER_ID);
    expect(ticket?.history).toHaveLength(1);
    expect(ticket?.history[0].toStatus).toBe("NEW");
  });

  it("creates a ticket with an image attachment", async () => {
    mockFriend();
    const formData = new FormData();
    formData.set("assetToken", TEST_TOKEN);
    formData.append("symptomCategories", "BRAKE");
    formData.append("images", new File(["fake-image-bytes"], "photo.png", { type: "image/png" }));

    const req = new NextRequest("http://localhost/api/liff/tickets", {
      method: "POST",
      headers: { authorization: "Bearer fake-line-token" },
      body: formData,
    });

    const res = await createTicket(req);
    expect(res.status).toBe(201);
    const body = await res.json();

    const attachments = await prisma.ticketAttachment.findMany({
      where: { ticketId: body.ticket.id },
    });
    expect(attachments).toHaveLength(1);
    expect(attachments[0].type).toBe("REPORT");
  });

  it("rejects submission with no symptom category selected (Req 3.4)", async () => {
    mockFriend();
    const formData = new FormData();
    formData.set("assetToken", TEST_TOKEN);

    const req = new NextRequest("http://localhost/api/liff/tickets", {
      method: "POST",
      headers: { authorization: "Bearer fake-line-token" },
      body: formData,
    });

    const res = await createTicket(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errorCode).toBe("VALIDATION_ERROR");
  });

  it("rejects OTHER category without description (Req 3.2)", async () => {
    mockFriend();
    const formData = new FormData();
    formData.set("assetToken", TEST_TOKEN);
    formData.append("symptomCategories", "OTHER");

    const req = new NextRequest("http://localhost/api/liff/tickets", {
      method: "POST",
      headers: { authorization: "Bearer fake-line-token" },
      body: formData,
    });

    const res = await createTicket(req);
    expect(res.status).toBe(400);
  });

  it("returns 403 NOT_FRIEND before touching the database when not a friend", async () => {
    mockNotFriend();
    const formData = new FormData();
    formData.set("assetToken", TEST_TOKEN);
    formData.append("symptomCategories", "BRAKE");

    const req = new NextRequest("http://localhost/api/liff/tickets", {
      method: "POST",
      headers: { authorization: "Bearer fake-line-token" },
      body: formData,
    });

    const res = await createTicket(req);
    expect(res.status).toBe(403);
  });

  it("returns 404 INVALID_QR for an unknown asset token", async () => {
    mockFriend();
    const formData = new FormData();
    formData.set("assetToken", "totally-unknown-token");
    formData.append("symptomCategories", "BRAKE");

    const req = new NextRequest("http://localhost/api/liff/tickets", {
      method: "POST",
      headers: { authorization: "Bearer fake-line-token" },
      body: formData,
    });

    const res = await createTicket(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.errorCode).toBe("INVALID_QR");
  });

  it("enforces rate limit after repeated submissions (Req 3.7)", async () => {
    mockFriend();

    const submit = () => {
      const formData = new FormData();
      formData.set("assetToken", TEST_TOKEN);
      formData.append("symptomCategories", "BRAKE");
      const req = new NextRequest("http://localhost/api/liff/tickets", {
        method: "POST",
        headers: { authorization: "Bearer fake-line-token" },
        body: formData,
      });
      return createTicket(req);
    };

    for (let i = 0; i < 5; i++) {
      const res = await submit();
      expect(res.status).toBe(201);
    }

    const limitedRes = await submit();
    expect(limitedRes.status).toBe(429);
    const body = await limitedRes.json();
    expect(body.errorCode).toBe("RATE_LIMITED");
  });
});
