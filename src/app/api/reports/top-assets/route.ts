import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth/require-role";
import { reportDateRangeSchema } from "@/lib/schemas/report";
import { withErrorHandling } from "@/lib/api-error";
import type { Prisma } from "@prisma/client";

const DEFAULT_LIMIT = 10;

/**
 * GET /api/reports/top-assets — รถที่มีการแจ้งซ่อมบ่อยที่สุด + ลูกค้าที่แจ้งซ่อมมากที่สุด (Req 10.2)
 * เข้าถึงได้: Admin, Manager
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  await requireRole(["ADMIN", "MANAGER"]);

  const { from, to } = reportDateRangeSchema.parse({
    from: req.nextUrl.searchParams.get("from") ?? undefined,
    to: req.nextUrl.searchParams.get("to") ?? undefined,
  });

  const where: Prisma.TicketWhereInput = {};
  if (from || to) {
    where.reportedAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const [topAssetsGrouped, topCustomersGrouped] = await Promise.all([
    prisma.ticket.groupBy({
      by: ["assetId"],
      where,
      _count: { _all: true },
      orderBy: { _count: { assetId: "desc" } },
      take: DEFAULT_LIMIT,
    }),
    prisma.ticket.groupBy({
      by: ["customerId"],
      where,
      _count: { _all: true },
      orderBy: { _count: { customerId: "desc" } },
      take: DEFAULT_LIMIT,
    }),
  ]);

  const assetIds = topAssetsGrouped.map((row) => row.assetId);
  const customerIds = topCustomersGrouped.map((row) => row.customerId);

  const [assets, customers] = await Promise.all([
    prisma.asset.findMany({
      where: { id: { in: assetIds } },
      select: { id: true, assetCode: true, model: true },
    }),
    prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true },
    }),
  ]);

  const assetById = new Map(assets.map((a) => [a.id, a]));
  const customerById = new Map(customers.map((c) => [c.id, c]));

  const topAssets = topAssetsGrouped.map((row) => ({
    asset: assetById.get(row.assetId) ?? null,
    ticketCount: row._count._all,
  }));

  const topCustomers = topCustomersGrouped.map((row) => ({
    customer: customerById.get(row.customerId) ?? null,
    ticketCount: row._count._all,
  }));

  return NextResponse.json({ topAssets, topCustomers });
});
