/**
 * Seed ข้อมูลตั้งต้นสำหรับ dev/demo
 * รัน: npm run prisma:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
const SEED_TECH_PASSWORD = process.env.SEED_TECH_PASSWORD ?? "ChangeMe123!";

async function main() {
  console.log("Seeding database...");

  // --- Users --------------------------------------------------------------
  const adminPasswordHash = await bcrypt.hash(SEED_ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash: adminPasswordHash,
      displayName: "ผู้ดูแลระบบ",
      role: "ADMIN",
    },
  });

  const techPasswordHash = await bcrypt.hash(SEED_TECH_PASSWORD, 10);
  const technician = await prisma.user.upsert({
    where: { username: "tech1" },
    update: {},
    create: {
      username: "tech1",
      passwordHash: techPasswordHash,
      displayName: "ช่างสมชาย",
      role: "TECHNICIAN",
    },
  });

  // --- Customers ------------------------------------------------------------
  // ใช้ assetCode/username เป็น natural key สำหรับ upsert แทน fixed uuid
  // (Zod v4 บังคับ uuid ต้องมี version/variant nibble ที่ถูกต้องตาม RFC ทำให้ fixed uuid แบบง่ายใช้ไม่ได้)
  const existingCustomer = await prisma.customer.findFirst({
    where: { name: "บริษัท ตัวอย่าง โลจิสติกส์ จำกัด" },
  });
  const customer = await prisma.customer.upsert({
    where: { id: existingCustomer?.id ?? crypto.randomUUID() },
    update: {},
    create: {
      name: "บริษัท ตัวอย่าง โลจิสติกส์ จำกัด",
      contactName: "คุณสมหญิง",
      phone: "081-234-5678",
      address: "99 หมู่ 1 ต.บางนา อ.บางนา จ.สมุทรปราการ",
      location: "คลังสินค้า A",
    },
  });

  // --- Assets ---------------------------------------------------------------
  const asset = await prisma.asset.upsert({
    where: { assetCode: "FL-0001" },
    update: {},
    create: {
      assetCode: "FL-0001",
      customerId: customer.id,
      model: "Toyota 8FD25",
      serialNo: "SN-2024-0001",
      location: "คลังสินค้า A - โซนรับสินค้า",
    },
  });

  await prisma.assetQrToken.upsert({
    where: { token: "seed-demo-token-fl-0001" },
    update: {},
    create: {
      assetId: asset.id,
      token: "seed-demo-token-fl-0001",
    },
  });

  console.log("Seed completed:");
  console.log(`  admin user: admin / ${SEED_ADMIN_PASSWORD}`);
  console.log(`  technician user: tech1 / ${SEED_TECH_PASSWORD}`);
  console.log(`  customer: ${customer.name}`);
  console.log(`  asset: ${asset.assetCode}`);
  console.log(`  technician id: ${technician.id}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
