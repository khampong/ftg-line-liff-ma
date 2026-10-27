"use client";

import { use, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  UserCheck,
  Play,
  CheckCheck,
  Lock,
  RotateCcw,
  XCircle,
  Paperclip,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { adminGet, adminPatch, adminPostForm, ApiClientError } from "@/app/admin/apiClient";
import { useSession } from "@/app/admin/useSession";

interface Technician {
  id: string;
  username: string;
  displayName: string;
  role: string;
  active: boolean;
}
interface TicketAttachment {
  id: string;
  type: "REPORT" | "REPAIR";
  mimeType: string;
  size: number;
  createdAt: string;
}
interface TicketDetail {
  id: string;
  ticketNo: string;
  status: string;
  symptomCategories: string[];
  description: string | null;
  repairNote: string | null;
  reportedAt: string;
  reporterName: string | null;
  asset: { id: string; assetCode: string; model: string | null; location: string | null };
  customer: { id: string; name: string; phone: string | null; address: string | null };
  assignee: { id: string; displayName: string } | null;
  attachments: TicketAttachment[];
}
interface HistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: string;
  actor: { displayName: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  NEW: "แจ้งใหม่",
  ACCEPTED: "รับเรื่อง",
  IN_PROGRESS: "กำลังซ่อม",
  REPAIRED: "ซ่อมเสร็จ",
  CLOSED: "ปิดงาน",
  CANCELLED: "ยกเลิก",
};
const STATUS_CLASS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  ACCEPTED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
  IN_PROGRESS: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  REPAIRED: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  CLOSED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
};

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="text-foreground font-medium">{value || "-"}</span>
    </div>
  );
}

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { data: sessionData } = useSession();
  const role = sessionData?.user.role;

  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [repairNote, setRepairNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: ticketData, isLoading } = useQuery({
    queryKey: ["tickets", id],
    queryFn: () => adminGet<{ ticket: TicketDetail }>(`/api/tickets/${id}`),
  });
  const { data: historyData } = useQuery({
    queryKey: ["tickets", id, "history"],
    queryFn: () => adminGet<{ history: HistoryEntry[] }>(`/api/tickets/${id}/history`),
  });
  const { data: techniciansData } = useQuery({
    queryKey: ["users", { role: "TECHNICIAN" }],
    queryFn: () => adminGet<{ users: Technician[] }>("/api/users"),
    enabled: role === "ADMIN",
  });

  const invalidateTicket = () => {
    queryClient.invalidateQueries({ queryKey: ["tickets", id] });
    queryClient.invalidateQueries({ queryKey: ["tickets", id, "history"] });
    queryClient.invalidateQueries({ queryKey: ["tickets"] });
  };

  const assignMutation = useMutation({
    mutationFn: (assigneeId: string) => adminPatch(`/api/tickets/${id}/assign`, { assigneeId }),
    onSuccess: () => {
      invalidateTicket();
      setActionError(null);
    },
    onError: (err) =>
      setActionError(err instanceof ApiClientError ? err.message : "มอบหมายไม่สำเร็จ"),
  });
  const statusMutation = useMutation({
    mutationFn: (input: { status: string; repairNote?: string; note?: string }) =>
      adminPatch(`/api/tickets/${id}/status`, input),
    onSuccess: () => {
      invalidateTicket();
      setActionError(null);
      setRepairNote("");
    },
    onError: (err) =>
      setActionError(err instanceof ApiClientError ? err.message : "เปลี่ยนสถานะไม่สำเร็จ"),
  });
  const attachmentMutation = useMutation({
    mutationFn: (files: FileList) => {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("images", f));
      return adminPostForm(`/api/tickets/${id}/attachments`, fd);
    },
    onSuccess: () => {
      invalidateTicket();
      setActionError(null);
    },
    onError: (err) =>
      setActionError(err instanceof ApiClientError ? err.message : "แนบรูปไม่สำเร็จ"),
  });

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  if (!ticketData)
    return (
      <Alert variant="destructive">
        <AlertDescription>ไม่พบใบแจ้งซ่อม</AlertDescription>
      </Alert>
    );

  const ticket = ticketData.ticket;
  const isClosed = ticket.status === "CLOSED";
  const isAdmin = role === "ADMIN";
  const isTechnician = role === "TECHNICIAN";
  const isAssignedToMe = ticket.assignee?.id === sessionData?.user.id;
  const technicians = (techniciansData?.users ?? []).filter(
    (u) => u.role === "TECHNICIAN" && u.active,
  );

  return (
    <div>
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/tickets">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-foreground">ใบแจ้งซ่อม {ticket.ticketNo}</h1>
            <span
              className={cn(
                "badge-status",
                STATUS_CLASS[ticket.status] ?? "bg-muted text-muted-foreground",
              )}
            >
              {STATUS_LABEL[ticket.status] ?? ticket.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            แจ้งเมื่อ {new Date(ticket.reportedAt).toLocaleString("th-TH")}
          </p>
        </div>
      </div>

      {actionError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}
      {isClosed && (
        <Alert className="mb-4">
          <AlertDescription>ใบแจ้งซ่อมนี้ปิดงานแล้ว ไม่สามารถแก้ไขได้อีก</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left column — info */}
        <div className="lg:col-span-7 space-y-4">
          {/* รถและลูกค้า */}
          <div className="card-default p-4">
            <h2 className="font-semibold text-foreground mb-3">ข้อมูลรถและลูกค้า</h2>
            <div className="space-y-1.5">
              <InfoRow label="รหัสรถ" value={ticket.asset.assetCode} />
              <InfoRow label="รุ่น" value={ticket.asset.model} />
              <InfoRow label="ลูกค้า" value={ticket.customer.name} />
              <InfoRow label="สถานที่" value={ticket.asset.location} />
              <InfoRow label="ผู้แจ้ง" value={ticket.reporterName} />
            </div>
          </div>

          {/* อาการเสีย */}
          <div className="card-default p-4">
            <h2 className="font-semibold text-foreground mb-3">อาการเสีย</h2>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {ticket.symptomCategories.map((c) => (
                <span key={c} className="badge-status bg-muted text-muted-foreground">
                  {c}
                </span>
              ))}
            </div>
            {ticket.description && (
              <p className="text-sm text-foreground mt-2">{ticket.description}</p>
            )}
          </div>

          {/* รูปภาพ */}
          {ticket.attachments.length > 0 && (
            <div className="card-default p-4">
              <h2 className="font-semibold text-foreground mb-3">รูปภาพแนบ</h2>
              <div className="grid grid-cols-4 gap-2">
                {ticket.attachments.map((att) => (
                  <div key={att.id} className="space-y-1">
                    <a href={`/api/attachments/${att.id}`} target="_blank" rel="noreferrer">
                      <img
                        src={`/api/attachments/${att.id}`}
                        alt={att.type}
                        className="w-full h-24 object-cover rounded-lg border border-border hover:opacity-90 transition-opacity"
                      />
                    </a>
                    <p className="text-xs text-muted-foreground text-center">
                      {att.type === "REPORT" ? "รูปแจ้งซ่อม" : "รูปหลังซ่อม"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ประวัติ */}
          <div className="card-default p-4">
            <h2 className="font-semibold text-foreground mb-3">ประวัติการเปลี่ยนแปลง</h2>
            <div className="space-y-3">
              {(historyData?.history ?? []).map((h, idx) => (
                <div key={h.id}>
                  {idx > 0 && <Separator className="mb-3" />}
                  <div className="text-sm">
                    <span className="font-medium text-foreground">
                      {h.fromStatus ? `${STATUS_LABEL[h.fromStatus] ?? h.fromStatus} → ` : ""}
                      {STATUS_LABEL[h.toStatus] ?? h.toStatus}
                    </span>
                    {h.actor && (
                      <span className="text-muted-foreground"> โดย {h.actor.displayName}</span>
                    )}
                  </div>
                  {h.note && <p className="text-xs text-muted-foreground mt-0.5">{h.note}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(h.createdAt).toLocaleString("th-TH")}
                  </p>
                </div>
              ))}
              {(historyData?.history ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">ไม่มีประวัติ</p>
              )}
            </div>
          </div>
        </div>

        {/* Right column — actions */}
        <div className="lg:col-span-5 space-y-4">
          {/* assignee info */}
          {ticket.assignee && (
            <div className="card-default p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {ticket.assignee.displayName.charAt(0)}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ช่างผู้รับผิดชอบ</p>
                <p className="font-semibold text-foreground">{ticket.assignee.displayName}</p>
              </div>
            </div>
          )}

          {/* มอบหมายช่าง — Admin, NEW */}
          {isAdmin && ticket.status === "NEW" && (
            <div className="card-default p-4">
              <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <UserCheck className="w-4 h-4" /> มอบหมายช่าง
              </h2>
              <div className="space-y-3">
                <Select value={selectedTechnicianId} onValueChange={setSelectedTechnicianId}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกช่าง" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full gap-2"
                  disabled={!selectedTechnicianId || assignMutation.isPending}
                  onClick={() => assignMutation.mutate(selectedTechnicianId)}
                >
                  {assignMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserCheck className="w-4 h-4" />
                  )}
                  มอบหมายงาน
                </Button>
              </div>
            </div>
          )}

          {/* เริ่มซ่อม — ช่าง, ACCEPTED */}
          {isTechnician && isAssignedToMe && ticket.status === "ACCEPTED" && (
            <div className="card-default p-4">
              <Button
                className="w-full gap-2"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate({ status: "IN_PROGRESS" })}
              >
                {statusMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                เริ่มซ่อม
              </Button>
            </div>
          )}

          {/* บันทึกผลซ่อม — ช่าง, IN_PROGRESS */}
          {isTechnician && isAssignedToMe && ticket.status === "IN_PROGRESS" && (
            <div className="card-default p-4">
              <h2 className="font-semibold text-foreground mb-3">บันทึกผลการซ่อม</h2>
              <div className="space-y-3">
                <Textarea
                  placeholder="รายละเอียดการซ่อม..."
                  rows={4}
                  value={repairNote}
                  onChange={(e) => setRepairNote(e.target.value)}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) attachmentMutation.mutate(e.target.files);
                  }}
                />
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={attachmentMutation.isPending}
                >
                  {attachmentMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Paperclip className="w-4 h-4" />
                  )}
                  แนบรูปหลังซ่อม
                </Button>
                <Button
                  className="w-full gap-2"
                  disabled={!repairNote.trim() || statusMutation.isPending}
                  onClick={() => statusMutation.mutate({ status: "REPAIRED", repairNote })}
                >
                  {statusMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCheck className="w-4 h-4" />
                  )}
                  ซ่อมเสร็จ
                </Button>
              </div>
            </div>
          )}

          {/* ปิดงาน — Admin, REPAIRED */}
          {isAdmin && ticket.status === "REPAIRED" && (
            <div className="card-default p-4">
              {ticket.repairNote && (
                <p className="text-sm text-muted-foreground mb-3 bg-muted rounded-lg p-3">
                  {ticket.repairNote}
                </p>
              )}
              <Button
                className="w-full gap-2 bg-green-600 hover:bg-green-700"
                disabled={statusMutation.isPending}
                onClick={() =>
                  statusMutation.mutate({ status: "CLOSED", note: "ปิดงานหลังลูกค้ารับทราบ" })
                }
              >
                {statusMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                ปิดงาน
              </Button>
            </div>
          )}

          {/* เปิดงานใหม่ — Admin, CLOSED */}
          {isAdmin && isClosed && (
            <div className="card-default p-4">
              <Button
                variant="outline"
                className="w-full gap-2"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate({ status: "ACCEPTED", note: "เปิดงานใหม่" })}
              >
                {statusMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                เปิดงานใหม่
              </Button>
            </div>
          )}

          {/* ยกเลิก — Admin, ก่อน REPAIRED */}
          {isAdmin && ["NEW", "ACCEPTED", "IN_PROGRESS"].includes(ticket.status) && (
            <div className="card-default p-4">
              <Button
                variant="destructive"
                className="w-full gap-2"
                disabled={statusMutation.isPending}
                onClick={() =>
                  statusMutation.mutate({ status: "CANCELLED", note: "ยกเลิกโดยแอดมิน" })
                }
              >
                {statusMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                ยกเลิกใบแจ้งซ่อม
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
