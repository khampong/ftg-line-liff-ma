import { afterEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import path from "node:path";
import {
  deleteStoredImage,
  isAllowedImageMimeType,
  readStoredImage,
  saveUploadedImage,
  storedImageExists,
} from "@/server/storage/file-storage";
import { ApiError } from "@/lib/api-error";

// vitest.config.mts ตั้ง UPLOAD_DIR เป็นโฟลเดอร์ temp เฉพาะสำหรับเทส
const TEST_UPLOAD_DIR = path.join(process.cwd(), ".vitest-uploads-tmp");

afterEach(async () => {
  await rm(TEST_UPLOAD_DIR, { recursive: true, force: true });
});

function makeFile(content: string, mimeType: string, name = "test.png"): File {
  return new File([content], name, { type: mimeType });
}

describe("isAllowedImageMimeType", () => {
  it("allows common image mime types", () => {
    expect(isAllowedImageMimeType("image/jpeg")).toBe(true);
    expect(isAllowedImageMimeType("image/png")).toBe(true);
    expect(isAllowedImageMimeType("image/webp")).toBe(true);
    expect(isAllowedImageMimeType("image/gif")).toBe(true);
  });

  it("rejects non-image mime types", () => {
    expect(isAllowedImageMimeType("application/pdf")).toBe(false);
    expect(isAllowedImageMimeType("text/html")).toBe(false);
    expect(isAllowedImageMimeType("application/x-msdownload")).toBe(false);
  });
});

describe("saveUploadedImage", () => {
  it("saves a valid image file and returns metadata", async () => {
    const file = makeFile("fake-png-bytes", "image/png");
    const result = await saveUploadedImage(file);

    expect(result.mimeType).toBe("image/png");
    expect(result.filePath).toMatch(/^[a-f0-9]{48}\.png$/);

    const exists = await storedImageExists(result.filePath);
    expect(exists).toBe(true);
  });

  it("generates different random filenames for each upload (non-guessable)", async () => {
    const file1 = await saveUploadedImage(makeFile("a", "image/png"));
    const file2 = await saveUploadedImage(makeFile("a", "image/png"));
    expect(file1.filePath).not.toBe(file2.filePath);
  });

  it("rejects disallowed mime types", async () => {
    const file = makeFile("not an image", "application/pdf");
    await expect(saveUploadedImage(file)).rejects.toMatchObject({
      errorCode: "UPLOAD_FAILED",
    });
  });

  it("rejects files larger than MAX_UPLOAD_SIZE_MB", async () => {
    // vitest.config.mts ตั้ง MAX_UPLOAD_SIZE_MB=1 สำหรับเทส -> เกิน 1MB ต้องถูก reject
    const oversized = "x".repeat(2 * 1024 * 1024);
    const file = makeFile(oversized, "image/png");
    await expect(saveUploadedImage(file)).rejects.toMatchObject({
      errorCode: "UPLOAD_FAILED",
    });
  });
});

describe("readStoredImage", () => {
  it("reads back the exact content that was saved", async () => {
    const content = "hello-image-bytes";
    const file = makeFile(content, "image/png");
    const saved = await saveUploadedImage(file);

    const buffer = await readStoredImage(saved.filePath);
    expect(buffer.toString()).toBe(content);
  });

  it("throws NOT_FOUND for a file that does not exist", async () => {
    await expect(readStoredImage("does-not-exist.png")).rejects.toMatchObject({
      errorCode: "NOT_FOUND",
    });
  });

  it("throws NOT_FOUND when attempting path traversal", async () => {
    await expect(readStoredImage("../../etc/passwd")).rejects.toBeInstanceOf(ApiError);
    await expect(readStoredImage("../../etc/passwd")).rejects.toMatchObject({
      errorCode: "NOT_FOUND",
    });
  });
});

describe("deleteStoredImage", () => {
  it("removes a previously saved file", async () => {
    const file = makeFile("to-be-deleted", "image/png");
    const saved = await saveUploadedImage(file);

    expect(await storedImageExists(saved.filePath)).toBe(true);
    await deleteStoredImage(saved.filePath);
    expect(await storedImageExists(saved.filePath)).toBe(false);
  });

  it("does not throw when deleting a file that does not exist", async () => {
    await expect(deleteStoredImage("never-existed.png")).resolves.toBeUndefined();
  });
});
