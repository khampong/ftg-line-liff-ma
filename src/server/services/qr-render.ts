import { readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

// Noto Sans Thai (SIL Open Font License 1.1) — รองรับตัวอักษรไทย ต่างจาก StandardFonts
// ของ pdf-lib ที่ใช้ WinAnsi encoding และไม่มีตัวอักษรไทย
// ที่มา: https://github.com/google/fonts/tree/main/ofl/notosansthai (ดู OFL.txt ในโฟลเดอร์เดียวกัน)
const THAI_FONT_PATH = path.join(process.cwd(), "src/server/assets/fonts/NotoSansThai-Regular.ttf");

let cachedThaiFontBytes: Buffer | null = null;
async function getThaiFontBytes(): Promise<Buffer> {
  if (!cachedThaiFontBytes) {
    cachedThaiFontBytes = await readFile(THAI_FONT_PATH);
  }
  return cachedThaiFontBytes;
}

/** สร้าง QR code เป็น PNG buffer จาก URL (Req 5.3) */
export async function renderQrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    width: 512,
    margin: 2,
    errorCorrectionLevel: "M",
  });
}

export interface QrLabelInfo {
  assetCode: string;
  customerName: string;
  model?: string | null;
  location?: string | null;
}

/**
 * สร้างเอกสาร PDF หน้าเดียวสำหรับพิมพ์ QR ติดข้างรถ
 * มี QR + รหัสรถ + ชื่อลูกค้ากำกับ (Req 5.3)
 */
export async function renderQrPdf(url: string, label: QrLabelInfo): Promise<Buffer> {
  const qrPngBuffer = await renderQrPng(url);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const page = pdfDoc.addPage([300, 420]);

  // ใช้ font เดียวกันทั้งตัวหนาและปกติ (Noto Sans Thai Regular ไม่มีตัวหนาแยกในไฟล์นี้)
  // subset: true ลดขนาดไฟล์โดย embed แค่ glyph ที่ใช้จริง
  const thaiFontBytes = await getThaiFontBytes();
  const font = await pdfDoc.embedFont(thaiFontBytes, { subset: true });
  const fontBold = font;

  const qrImage = await pdfDoc.embedPng(qrPngBuffer);
  const qrSize = 240;
  page.drawImage(qrImage, {
    x: (300 - qrSize) / 2,
    y: 420 - qrSize - 40,
    width: qrSize,
    height: qrSize,
  });

  page.drawText("สแกนเพื่อแจ้งซ่อม", {
    x: 30,
    y: 420 - 25,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  page.drawText(`รหัสรถ: ${label.assetCode}`, {
    x: 30,
    y: 420 - qrSize - 60,
    size: 12,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  let y = 420 - qrSize - 78;
  const lines = [
    label.model ? `รุ่น: ${label.model}` : null,
    `ลูกค้า: ${label.customerName}`,
    label.location ? `สถานที่: ${label.location}` : null,
  ].filter((line): line is string => Boolean(line));

  for (const line of lines) {
    page.drawText(line, { x: 30, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
    y -= 16;
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
