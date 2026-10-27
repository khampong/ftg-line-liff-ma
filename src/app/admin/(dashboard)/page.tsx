"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, Play } from "lucide-react";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { adminGet, adminPatch, ApiClientError } from "@/app/admin/apiClient";
import { useSession } from "@/app/admin/useSession";
import { cn } from "@/lib/utils";

/* ========== types ========== */
interface SummaryResponse {
  total: number;
  byStatus: Record<string, number>;
}

interface TicketListItem {
  id: string;
  ticketNo: string;
  status: string;
  symptomCategories: string[];
  reportedAt: string;
  asset: { assetCode: string; model: string | null; location: string | null };
  customer: { name: string };
  assignee: { id: string; displayName: string } | null;
}

/* ========== constants ========== */
const STATUS_LABEL: Record<string, string> = {
  NEW: "แจ้งใหม่",
  ACCEPTED: "รับเรื่อง",
  IN_PROGRESS: "กำลังซ่อม",
  REPAIRED: "ซ่อมเสร็จ",
  CLOSED: "ปิดงาน",
  CANCELLED: "ยกเลิก",
};

const STATUS_ICON: Record<string, string> = {
  NEW: "solar:bell-linear",
  ACCEPTED: "solar:check-read-linear",
  IN_PROGRESS: "solar:settings-linear",
  REPAIRED: "solar:verified-check-linear",
  CLOSED: "solar:lock-linear",
  CANCELLED: "solar:close-circle-linear",
};

const STATUS_COLOR: Record<string, string> = {
  NEW: "text-blue-500 bg-blue-50 dark:bg-blue-500/10",
  ACCEPTED: "text-yellow-500 bg-yellow-50 dark:bg-yellow-500/10",
  IN_PROGRESS: "text-orange-500 bg-orange-50 dark:bg-orange-500/10",
  REPAIRED: "text-green-600 bg-green-50 dark:bg-green-500/10",
  CLOSED: "text-muted-foreground bg-muted",
  CANCELLED: "text-red-500 bg-red-50 dark:bg-red-500/10",
};

const TICKET_BORDER: Record<string, string> = {
  ACCEPTED: "border-l-4 border-l-yellow-400",
  IN_PROGRESS: "border-l-4 border-l-orange-400",
  REPAIRED: "border-l-4 border-l-green-500",
};

/* ========== Technician Dashboard ========== */
function TechnicianDashboard({ userId }: { userId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // ดึงงานทั้งหมดที่ assign ให้ตัวเอง (ACCEPTED + IN_PROGRESS + REPAIRED)
  const { data: acceptedData, isLoading: l1 } = useQuery({
    queryKey: ["tickets", { status: "ACCEPTED", assignee: userId }],
    queryFn: () => adminGet<{ tickets: TicketListItem[] }>("/api/tickets?status=ACCEPTED"),
  });
  const { data: inProgressData, isLoading: l2 } = useQuery({
    queryKey: ["tickets", { status: "IN_PROGRESS", assignee: userId }],
    queryFn: () => adminGet<{ tickets: TicketListItem[] }>("/api/tickets?status=IN_PROGRESS"),
  });
  const { data: repairedData, isLoading: l3 } = useQuery({
    queryKey: ["tickets", { status: "REPAIRED", assignee: userId }],
    queryFn: () => adminGet<{ tickets: TicketListItem[] }>("/api/tickets?status=REPAIRED"),
  });

  const isLoading = l1 || l2 || l3;

  // filter เฉพาะงานของตัวเอง
  const myAccepted = (acceptedData?.tickets ?? []).filter((t) => t.assignee?.id === userId);
  const myInProgress = (inProgressData?.tickets ?? []).filter((t) => t.assignee?.id === userId);
  const myRepaired = (repairedData?.tickets ?? []).filter((t) => t.assignee?.id === userId);

  const totalMine = myAccepted.length + myInProgress.length + myRepaired.length;

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminPatch(`/api/tickets/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>กำลังโหลด...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">งานของฉัน</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {totalMine > 0 ? `มีงานรอดำเนินการ ${totalMine} ใบ` : "ไม่มีงานค้างอยู่"}
        </p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "รอเริ่มซ่อม", count: myAccepted.length, status: "ACCEPTED" },
          { label: "กำลังซ่อม", count: myInProgress.length, status: "IN_PROGRESS" },
          { label: "รอปิดงาน", count: myRepaired.length, status: "REPAIRED" },
        ].map(({ label, count, status }) => (
          <div key={status} className="card-default p-4">
            <div
              className={cn(
                "inline-flex items-center justify-center w-9 h-9 rounded-lg mb-3",
                STATUS_COLOR[status],
              )}
            >
              <Icon icon={STATUS_ICON[status]} width={18} />
            </div>
            <p className="text-2xl font-bold text-foreground">{count}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>

      {totalMine === 0 && (
        <div className="card-default p-12 flex flex-col items-center justify-center text-center">
          <Icon icon="solar:check-circle-linear" width={48} className="text-green-500 mb-3" />
          <p className="font-semibold text-foreground">ไม่มีงานค้าง</p>
          <p className="text-sm text-muted-foreground mt-1">เย่! ทุกงานเสร็จสิ้นแล้ว</p>
        </div>
      )}

      {/* กลุ่ม ACCEPTED — รอเริ่มซ่อม */}
      {myAccepted.length > 0 && (
        <TicketGroup
          title="รอเริ่มซ่อม"
          status="ACCEPTED"
          tickets={myAccepted}
          actionLabel="เริ่มซ่อม"
          actionIcon={<Play className="w-3.5 h-3.5" />}
          actionNextStatus="IN_PROGRESS"
          onAction={(id) => statusMutation.mutate({ id, status: "IN_PROGRESS" })}
          isPending={statusMutation.isPending}
          onCardClick={(id) => router.push(`/admin/tickets/${id}`)}
        />
      )}

      {/* กลุ่ม IN_PROGRESS — กำลังซ่อม */}
      {myInProgress.length > 0 && (
        <TicketGroup
          title="กำลังซ่อม"
          status="IN_PROGRESS"
          tickets={myInProgress}
          actionLabel="บันทึกผลซ่อม"
          actionIcon={<ArrowRight className="w-3.5 h-3.5" />}
          actionNextStatus={null}
          onAction={(id) => router.push(`/admin/tickets/${id}`)}
          isPending={false}
          onCardClick={(id) => router.push(`/admin/tickets/${id}`)}
        />
      )}

      {/* กลุ่ม REPAIRED — รอปิดงาน */}
      {myRepaired.length > 0 && (
        <TicketGroup
          title="รอ Admin ปิดงาน"
          status="REPAIRED"
          tickets={myRepaired}
          actionLabel="ดูรายละเอียด"
          actionIcon={<ArrowRight className="w-3.5 h-3.5" />}
          actionNextStatus={null}
          onAction={(id) => router.push(`/admin/tickets/${id}`)}
          isPending={false}
          onCardClick={(id) => router.push(`/admin/tickets/${id}`)}
        />
      )}
    </div>
  );
}

/* ========== TicketGroup ========== */
function TicketGroup({
  title,
  status,
  tickets,
  actionLabel,
  actionIcon,
  onAction,
  isPending,
  onCardClick,
}: {
  title: string;
  status: string;
  tickets: TicketListItem[];
  actionLabel: string;
  actionIcon: React.ReactNode;
  actionNextStatus: string | null;
  onAction: (id: string) => void;
  isPending: boolean;
  onCardClick: (id: string) => void;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className={cn("badge-status", STATUS_COLOR[status])}>{STATUS_LABEL[status]}</span>
        <span className="text-sm text-muted-foreground">{tickets.length} ใบ</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {tickets.map((ticket) => (
          <div
            key={ticket.id}
            className={cn(
              "card-default p-4 cursor-pointer hover:shadow-md transition-shadow",
              TICKET_BORDER[status] ?? "",
            )}
            onClick={() => onCardClick(ticket.id)}
          >
            {/* header */}
            <div className="flex items-start justify-between mb-3">
              <span className="font-mono text-xs font-semibold text-primary">
                {ticket.ticketNo}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(ticket.reportedAt).toLocaleDateString("th-TH")}
              </span>
            </div>

            {/* รถ + ลูกค้า */}
            <div className="space-y-1 mb-3">
              <div className="flex items-center gap-1.5">
                <Icon
                  icon="solar:tram-linear"
                  width={14}
                  className="text-muted-foreground shrink-0"
                />
                <span className="text-sm font-semibold text-foreground">
                  {ticket.asset.assetCode}
                </span>
                {ticket.asset.model && (
                  <span className="text-xs text-muted-foreground">({ticket.asset.model})</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Icon
                  icon="solar:user-linear"
                  width={14}
                  className="text-muted-foreground shrink-0"
                />
                <span className="text-xs text-muted-foreground">{ticket.customer.name}</span>
              </div>
              {ticket.asset.location && (
                <div className="flex items-center gap-1.5">
                  <Icon
                    icon="solar:map-point-linear"
                    width={14}
                    className="text-muted-foreground shrink-0"
                  />
                  <span className="text-xs text-muted-foreground">{ticket.asset.location}</span>
                </div>
              )}
            </div>

            {/* อาการเสีย */}
            <div className="flex flex-wrap gap-1 mb-3">
              {ticket.symptomCategories.slice(0, 3).map((c) => (
                <span key={c} className="badge-status bg-muted text-muted-foreground text-[10px]">
                  {c}
                </span>
              ))}
              {ticket.symptomCategories.length > 3 && (
                <span className="badge-status bg-muted text-muted-foreground text-[10px]">
                  +{ticket.symptomCategories.length - 3}
                </span>
              )}
            </div>

            {/* action button */}
            <Button
              size="sm"
              className="w-full gap-1.5 mt-auto"
              variant={status === "REPAIRED" ? "outline" : "default"}
              disabled={isPending}
              onClick={(e) => {
                e.stopPropagation();
                onAction(ticket.id);
              }}
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : actionIcon}
              {actionLabel}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========== Admin/Manager Dashboard ========== */
function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "summary"],
    queryFn: () => adminGet<SummaryResponse>("/api/reports/summary"),
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">แดชบอร์ด</h1>
        <p className="text-sm text-muted-foreground mt-1">ภาพรวมสถานะใบแจ้งซ่อมทั้งหมด</p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>กำลังโหลด...</span>
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="card-default p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">ทั้งหมด</p>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon icon="solar:document-text-linear" width={20} className="text-primary" />
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground">{data.total}</p>
            </div>
          </div>

          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            แยกตามสถานะ
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.entries(data.byStatus).map(([status, count]) => (
              <div key={status} className="card-default p-4">
                <div
                  className={cn(
                    "inline-flex items-center justify-center w-9 h-9 rounded-lg mb-3",
                    STATUS_COLOR[status] ?? "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon icon={STATUS_ICON[status] ?? "solar:document-linear"} width={18} />
                </div>
                <p className="text-2xl font-bold text-foreground">{count}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {STATUS_LABEL[status] ?? status}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ========== Root ========== */
export default function DashboardPage() {
  const { data: session, isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (session?.user.role === "TECHNICIAN") {
    return <TechnicianDashboard userId={session.user.id} />;
  }

  return <AdminDashboard />;
}
