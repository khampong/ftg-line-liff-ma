"use client";

import liff from "@line/liff";

/**
 * wrap LIFF SDK ให้เรียกใช้ง่ายจากฝั่ง client
 * (Req 1.1, 1.4)
 */

let initPromise: Promise<void> | null = null;

/** เรียก liff.init ครั้งเดียว (idempotent แม้เรียกซ้ำจากหลาย component) */
export function initLiff(): Promise<void> {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!liffId) {
    return Promise.reject(new Error("ไม่ได้ตั้งค่า NEXT_PUBLIC_LIFF_ID"));
  }

  if (!initPromise) {
    initPromise = liff.init({ liffId }).catch((error) => {
      initPromise = null; // ให้ retry ได้ถ้า init ล้มเหลว
      throw error;
    });
  }
  return initPromise;
}

/** ล็อกอินด้วย LINE ถ้ายังไม่ได้ล็อกอิน (จะ redirect ออกจากแอปแล้วกลับมาเมื่อสำเร็จ) */
export function ensureLoggedIn(): void {
  if (!liff.isLoggedIn()) {
    liff.login();
  }
}

/** ดึง access token ที่ LIFF SDK verify ให้แล้ว ใช้ส่งไป backend เพื่อยืนยันตัวตนอีกชั้น */
export function getLiffAccessToken(): string | null {
  return liff.getAccessToken();
}

export interface LiffUserProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

/** ดึง LINE profile จาก LIFF SDK (ใช้แสดงผลฝั่ง UI เท่านั้น ไม่ใช่แหล่งความจริงสำหรับ backend) */
export async function getLiffProfile(): Promise<LiffUserProfile> {
  return liff.getProfile();
}

export function isInLineClient(): boolean {
  return liff.isInClient();
}

export { liff };
