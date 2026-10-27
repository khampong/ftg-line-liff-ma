import { randomBytes } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { env } from "@/server/env";
import { ApiError } from "@/lib/api-error";

/**
 * จัดการไฟล์รูปภาพ:
 * - หากตั้งค่า R2_BUCKET_NAME, R2_ACCOUNT_ID ฯลฯ จะจัดเก็บบน Cloudflare R2 (S3-compatible)
 * - หากไม่ได้ระบุ จะ fallback เป็น local filesystem (mount PVC หรือ local dev)
 * ไม่ expose path ตรงๆ ให้ client เข้าถึงรูปต้องผ่าน /api/attachments/[id] ที่ตรวจสิทธิ์เสมอ (Req 11.3)
 */

let s3ClientInstance: S3Client | null = null;

export function isR2Configured(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET_NAME,
  );
}

function getS3Client(): S3Client {
  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3ClientInstance;
}

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function isAllowedImageMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType);
}

export function getMaxUploadSizeBytes(): number {
  return env.MAX_UPLOAD_SIZE_MB * 1024 * 1024;
}

function resolveUploadDir(): string {
  // ใช้ /*turbopackIgnore*/ เพื่อไม่ให้ Next.js trace ทั้งโปรเจกต์เข้า serverless bundle
  // (path นี้ขึ้นกับ env ที่ runtime ไม่ใช่ static path ที่ bundler วิเคราะห์ได้ล่วงหน้า)
  return path.isAbsolute(env.UPLOAD_DIR)
    ? env.UPLOAD_DIR
    : path.join(/* turbopackIgnore: true */ process.cwd(), env.UPLOAD_DIR);
}

/** สร้างชื่อไฟล์แบบสุ่ม ไม่เดาได้ ป้องกันการเดา path ไฟล์คนอื่น */
function generateRandomFilename(mimeType: string): string {
  const extension = MIME_TO_EXTENSION[mimeType] ?? "bin";
  const randomName = randomBytes(24).toString("hex");
  return `${randomName}.${extension}`;
}

export interface SavedFile {
  /** path สัมพัทธ์ที่เก็บลง DB (ไม่ใช่ absolute path ของเครื่อง) */
  filePath: string;
  mimeType: string;
  size: number;
}

function getR2Key(filename: string): string {
  const folder = (env.R2_FOLDER ?? "").trim().replace(/^\/+|\/+$/g, "");
  return folder ? `${folder}/${filename}` : filename;
}

/**
 * บันทึกไฟล์รูปที่อัปโหลดลง Cloudflare R2 หรือ UPLOAD_DIR ตรวจ mime/ขนาดก่อนเขียนเสมอ (Req 11.1, 11.2)
 */
export async function saveUploadedImage(file: File): Promise<SavedFile> {
  if (!isAllowedImageMimeType(file.type)) {
    throw new ApiError("UPLOAD_FAILED", "รองรับเฉพาะไฟล์รูปภาพ (JPEG, PNG, WEBP, GIF) เท่านั้น");
  }

  const maxBytes = getMaxUploadSizeBytes();
  if (file.size > maxBytes) {
    throw new ApiError(
      "UPLOAD_FAILED",
      `ไฟล์มีขนาดใหญ่เกินไป (จำกัดไม่เกิน ${env.MAX_UPLOAD_SIZE_MB}MB)`,
    );
  }

  const filename = generateRandomFilename(file.type);
  const buffer = Buffer.from(await file.arrayBuffer());

  if (isR2Configured()) {
    try {
      const client = getS3Client();
      const r2Key = getR2Key(filename);
      await client.send(
        new PutObjectCommand({
          Bucket: env.R2_BUCKET_NAME,
          Key: r2Key,
          Body: buffer,
          ContentType: file.type,
        }),
      );
      return { filePath: r2Key, mimeType: file.type, size: file.size };
    } catch {
      throw new ApiError("UPLOAD_FAILED", "ไม่สามารถอัปโหลดไฟล์ไปยัง Cloudflare R2 ได้");
    }
  }

  const uploadDir = resolveUploadDir();
  await mkdir(uploadDir, { recursive: true });

  const absolutePath = path.join(/* turbopackIgnore: true */ uploadDir, filename);
  await writeFile(absolutePath, buffer);

  return { filePath: filename, mimeType: file.type, size: file.size };
}

/** อ่านไฟล์รูปจาก filePath ที่เก็บใน DB กลับมาเป็น Buffer (สำหรับ stream ผ่าน /api/attachments/[id]) */
export async function readStoredImage(filePath: string): Promise<Buffer> {
  if (isR2Configured()) {
    try {
      const client = getS3Client();
      const response = await client.send(
        new GetObjectCommand({
          Bucket: env.R2_BUCKET_NAME,
          Key: filePath,
        }),
      );
      if (!response.Body) {
        throw new ApiError("NOT_FOUND", "ไม่พบไฟล์");
      }
      const byteArray = await response.Body.transformToByteArray();
      return Buffer.from(byteArray);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("NOT_FOUND", "ไม่พบไฟล์");
    }
  }

  const uploadDir = resolveUploadDir();
  const absolutePath = path.join(/* turbopackIgnore: true */ uploadDir, filePath);

  // ป้องกัน path traversal (เช่น filePath = "../../etc/passwd")
  const normalizedUploadDir = path.normalize(uploadDir);
  const normalizedTarget = path.normalize(absolutePath);
  if (!normalizedTarget.startsWith(normalizedUploadDir)) {
    throw new ApiError("NOT_FOUND", "ไม่พบไฟล์");
  }

  try {
    return await readFile(normalizedTarget);
  } catch {
    throw new ApiError("NOT_FOUND", "ไม่พบไฟล์");
  }
}

/** ตรวจว่าไฟล์มีอยู่จริงหรือไม่ (ใช้ตรวจสอบก่อนลบ/ทำความสะอาด) */
export async function storedImageExists(filePath: string): Promise<boolean> {
  if (isR2Configured()) {
    try {
      const client = getS3Client();
      await client.send(
        new HeadObjectCommand({
          Bucket: env.R2_BUCKET_NAME,
          Key: filePath,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  const uploadDir = resolveUploadDir();
  const absolutePath = path.join(/* turbopackIgnore: true */ uploadDir, filePath);
  try {
    await stat(absolutePath);
    return true;
  } catch {
    return false;
  }
}

/** ลบไฟล์ (ใช้กรณี rollback การอัปโหลดที่ไม่สำเร็จ) */
export async function deleteStoredImage(filePath: string): Promise<void> {
  if (isR2Configured()) {
    try {
      const client = getS3Client();
      await client.send(
        new DeleteObjectCommand({
          Bucket: env.R2_BUCKET_NAME,
          Key: filePath,
        }),
      );
    } catch {
      // ไม่มีไฟล์อยู่แล้วก็ไม่ต้อง error
    }
    return;
  }

  const uploadDir = resolveUploadDir();
  const absolutePath = path.join(/* turbopackIgnore: true */ uploadDir, filePath);
  try {
    await unlink(absolutePath);
  } catch {
    // ไม่มีไฟล์อยู่แล้วก็ไม่ต้อง error
  }
}
