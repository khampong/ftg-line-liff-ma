"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Sidebar from "@/components/admin/Sidebar";
import Header from "@/components/admin/Header";
import { useSession } from "@/app/admin/useSession";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data, isLoading, isError } = useSession();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !data?.user) {
    router.replace("/admin/login");
    return null;
  }

  const user = data.user;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar — permanent, xl+ */}
      <aside className="hidden xl:block fixed left-0 top-0 h-screen z-20">
        <Sidebar user={user} />
      </aside>

      {/* Main content area — offset by sidebar width on xl+ */}
      <div className="page-wrapper flex flex-col flex-1 min-h-screen w-full">
        <Header user={user} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
