"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { liff } from "@/app/liff/liffClient";

function AddFriendContent() {
  const searchParams = useSearchParams();
  const assetToken = searchParams.get("asset");
  const [requesting, setRequesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAddFriend = async () => {
    setRequesting(true);
    setErrorMessage(null);
    try {
      const friendship = await liff.getFriendship().catch(() => null);
      if (friendship && !friendship.friendFlag && typeof liff.requestFriendship === "function") {
        await liff.requestFriendship();
      }
      const target = assetToken ? `/liff/report?asset=${encodeURIComponent(assetToken)}` : "/liff";
      window.location.href = target;
    } catch {
      setErrorMessage("ไม่สามารถเปิดหน้าเพิ่มเพื่อนอัตโนมัติได้ กรุณาเพิ่มเพื่อนด้วยตนเอง");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-sm space-y-6">
        {/* Icon */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-500/15 flex items-center justify-center">
            <Icon icon="line-md:telegram" width={40} className="text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-foreground">กรุณาเพิ่มเพื่อนก่อนแจ้งซ่อม</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            เพื่อให้เราสามารถติดตามและดำเนินการแจ้งซ่อมของคุณได้ กรุณาเพิ่มเพื่อน LINE Official
            Account ของเราก่อน แล้วลองสแกน QR ใหม่อีกครั้ง
          </p>
        </div>

        {/* Action */}
        <Button size="lg" className="w-full gap-2" onClick={handleAddFriend} disabled={requesting}>
          {requesting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <UserPlus className="w-5 h-5" />
          )}
          เพิ่มเพื่อน / ลองใหม่
        </Button>

        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      </div>
    </div>
  );
}

export default function AddFriendPage() {
  return (
    <Suspense fallback={null}>
      <AddFriendContent />
    </Suspense>
  );
}
