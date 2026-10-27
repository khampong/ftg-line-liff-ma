import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { buildLiffUrlForToken } from "@/server/services/qr-token";
import { renderQrPdf, renderQrPng } from "@/server/services/qr-render";
import { env } from "@/server/env";
import { ApiError, withErrorHandling } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/assets/[id]/qr?format=png|pdf — ดาวน์โหลด/พิมพ์ QR ของรถ (เฉพาะ Admin)
 * ใช้ token ที่ active อยู่ปัจจุบัน ถ้ายังไม่มี token เลยให้แจ้งว่าต้อง rotate ก่อน (Req 5.1, 5.3)
 */
export const GET = withErrorHandling(async (req: NextRequest, { params }: RouteParams) => {
  await requireRole(["ADMIN"]);
  const { id } = await params;

  const asset = await prisma.asset.findUnique({
    where: { id },
    include: { customer: { select: { name: true } } },
  });
  if (!asset) {
    throw new ApiError("NOT_FOUND", "ไม่พบรถ");
  }

  const activeToken = await prisma.assetQrToken.findFirst({
    where: { assetId: id, active: true },
    orderBy: { createdAt: "desc" },
  });
  if (!activeToken) {
    throw new ApiError(
      "NOT_FOUND",
      "รถคันนี้ยังไม่มี QR token กรุณาออก QR ก่อน (POST /api/assets/:id/qr/rotate)",
    );
  }

  const format = req.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "png";
  const liffUrl = buildLiffUrlForToken(
    activeToken.token,
    env.NEXT_PUBLIC_LIFF_ID,
    env.PUBLIC_BASE_URL,
  );

  if (format === "pdf") {
    const pdfBuffer = await renderQrPdf(liffUrl, {
      assetCode: asset.assetCode,
      customerName: asset.customer.name,
      model: asset.model,
      location: asset.location,
    });
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="qr-${asset.assetCode}.pdf"`,
      },
    });
  }

  const pngBuffer = await renderQrPng(liffUrl);
  return new NextResponse(new Uint8Array(pngBuffer), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="qr-${asset.assetCode}.png"`,
    },
  });
});
