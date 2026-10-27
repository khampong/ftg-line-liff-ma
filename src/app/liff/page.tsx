"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, QrCode } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { initLiff } from "@/app/liff/liffClient";
import liff from "@line/liff";

function LiffEntryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [resolvedToken, setResolvedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function resolve() {
      // 1. อ่านจาก URL ?asset= ตรงๆ ก่อน (กรณีเข้าตรงหรือ redirect จาก QR admin)
      const directToken = searchParams.get("asset");
      if (directToken) {
        router.replace(`/liff/report?asset=${encodeURIComponent(directToken)}`);
        return;
      }

      // 2. ถ้าไม่มีใน URL ต้อง init LIFF แล้วอ่าน liff.state
      // (LIFF จะเก็บ query string เดิมไว้ใน liff.state หลัง redirect login กลับมา)
      try {
        await initLiff();

        // วิธีที่ 1: อ่านจาก window.location.search หลัง LIFF restore state
        const windowParams = new URLSearchParams(window.location.search);
        const tokenFromWindow = windowParams.get("asset");
        if (tokenFromWindow) {
          router.replace(`/liff/report?asset=${encodeURIComponent(tokenFromWindow)}`);
          return;
        }

        // วิธีที่ 3: liff.state ใน hash (#liff.state=...)
        const hash = window.location.hash;
        if (hash) {
          try {
            const hashParams = new URLSearchParams(
              decodeURIComponent(hash.replace("#liff.state=", "")),
            );
            const tokenFromHash = hashParams.get("asset");
            if (tokenFromHash) {
              router.replace(`/liff/report?asset=${encodeURIComponent(tokenFromHash)}`);
              return;
            }
          } catch {
            // ignore parse error
          }
        }

        // ไม่พบ token จากที่ไหนเลย
        setError("ไม่พบข้อมูล QR กรุณาสแกน QR ข้างรถอีกครั้ง");
        setResolvedToken(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด กรุณาลองใหม่");
      }
    }

    resolve();
  }, [router, searchParams]);

  // กำลัง resolve
  if (!error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
      </div>
    );
  }

  // error — ไม่พบ token
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mb-2">
          <QrCode className="w-8 h-8 text-muted-foreground" />
        </div>
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <p className="text-xs text-muted-foreground">กรุณาสแกน QR Code ข้างรถโฟล์คลิฟท์</p>
      </div>
    </div>
  );
}

export default function LiffEntryPage() {
  return (
    <Suspense fallback={null}>
      <LiffEntryContent />
    </Suspense>
  );
}
