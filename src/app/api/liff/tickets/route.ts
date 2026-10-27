import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { authenticateLineUser } from "@/server/line/auth";
import { resolveAssetByQrToken } from "@/server/services/qr-token";
import { generateTicketNo } from "@/server/services/ticket-number";
import { saveUploadedImage, deleteStoredImage } from "@/server/storage/file-storage";
import { createTicketFromLiffSchema, symptomCategorySchema } from "@/lib/schemas/ticket";
import { checkRateLimit } from "@/server/services/rate-limit";
import { ApiError, withErrorHandling } from "@/lib/api-error";
import type { SavedFile } from "@/server/storage/file-storage";

const MAX_ATTACHMENTS = 5;

// กันสแปม: ต่อ LINE user แจ้งซ่อมได้ไม่เกิน 5 ครั้งใน 10 นาที (Req 3.7 เรื่องความเสถียร)
const RATE_LIMIT_OPTIONS = { limit: 5, windowMs: 10 * 60 * 1000 };

/**
 * POST /api/liff/tickets — ลูกค้าส่งฟอร์มแจ้งซ่อม (multipart/form-data)
 * (Req 2.4, 3.1-3.6)
 *
 * fields:
 *  - assetToken: string (จาก QR)
 *  - symptomCategories: string[] (ส่งซ้ำหลาย field เดียวกัน หรือ comma-separated ก็ได้)
 *  - description: string (optional, บังคับถ้ามี OTHER)
 *  - images: File[] (0-5 ไฟล์)
 *
 * ผูก asset/customer/location อัตโนมัติจาก QR token (ลูกค้าไม่ต้องกรอกข้อมูลติดต่อเอง)
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const authHeader = req.headers.get("authorization") ?? "";
  const lineAccessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  const { profile, isFriend } = await authenticateLineUser(lineAccessToken);

  if (!isFriend) {
    throw new ApiError("NOT_FRIEND", "กรุณาเพิ่มเพื่อน LINE Official Account ก่อนแจ้งซ่อม");
  }

  checkRateLimit(profile.userId, RATE_LIMIT_OPTIONS);

  const formData = await req.formData();

  const assetToken = formData.get("assetToken");
  const description = formData.get("description");
  const symptomCategoriesRaw = formData.getAll("symptomCategories");
  const imageFiles = formData.getAll("images").filter((v): v is File => v instanceof File);

  if (imageFiles.length > MAX_ATTACHMENTS) {
    throw new ApiError("VALIDATION_ERROR", `แนบรูปได้ไม่เกิน ${MAX_ATTACHMENTS} รูป`);
  }

  // รองรับทั้งกรณีส่ง symptomCategories หลาย field และกรณี comma-separated string เดียว
  const symptomCategories = symptomCategoriesRaw
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  const input = createTicketFromLiffSchema.parse({
    assetToken: typeof assetToken === "string" ? assetToken : "",
    symptomCategories: symptomCategories.map((c) => symptomCategorySchema.parse(c)),
    description: typeof description === "string" ? description : undefined,
  });

  const { asset } = await resolveAssetByQrToken(input.assetToken);

  // บันทึกรูปทั้งหมดก่อน (ถ้า fail กลางทางให้ลบรูปที่บันทึกไปแล้วเพื่อไม่ทิ้งไฟล์ค้าง)
  const savedFiles: SavedFile[] = [];
  try {
    for (const file of imageFiles) {
      const saved = await saveUploadedImage(file);
      savedFiles.push(saved);
    }

    const ticketNo = await generateTicketNo();

    const ticket = await prisma.ticket.create({
      data: {
        ticketNo,
        assetId: asset.id,
        customerId: asset.customerId,
        lineUserId: profile.userId,
        reporterName: profile.displayName,
        reporterPicture: profile.pictureUrl,
        symptomCategories: input.symptomCategories,
        description: input.description,
        status: "NEW",
        attachments: {
          create: savedFiles.map((file) => ({
            type: "REPORT" as const,
            filePath: file.filePath,
            mimeType: file.mimeType,
            size: file.size,
          })),
        },
        history: {
          create: {
            toStatus: "NEW",
            note: "ลูกค้าแจ้งซ่อมผ่าน LINE",
          },
        },
      },
      select: { id: true, ticketNo: true, reportedAt: true },
    });

    return NextResponse.json(
      {
        ticket: {
          id: ticket.id,
          ticketNo: ticket.ticketNo,
          reportedAt: ticket.reportedAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    // rollback ไฟล์ที่บันทึกไปแล้วถ้าสร้าง ticket ไม่สำเร็จ
    await Promise.all(savedFiles.map((file) => deleteStoredImage(file.filePath)));
    throw error;
  }
});
