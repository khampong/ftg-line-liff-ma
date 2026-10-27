"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

function SuccessContent() {
  const searchParams = useSearchParams();
  const ticketNo = searchParams.get("ticketNo");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-sm space-y-5">
        {/* Success icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-500/15 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-bold text-foreground">แจ้งซ่อมสำเร็จ</h1>
          <p className="text-sm text-muted-foreground">ทีมงานได้รับเรื่องแจ้งซ่อมของคุณแล้ว</p>
        </div>

        {ticketNo && (
          <div className="bg-muted rounded-xl px-6 py-4 space-y-1">
            <p className="text-xs text-muted-foreground">หมายเลขใบแจ้งซ่อม</p>
            <p className="text-2xl font-bold font-mono text-foreground">{ticketNo}</p>
          </div>
        )}

        <p className="text-sm text-muted-foreground leading-relaxed">
          จะดำเนินการมอบหมายช่างและติดต่อกลับหาคุณโดยเร็ว
        </p>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessContent />
    </Suspense>
  );
}
