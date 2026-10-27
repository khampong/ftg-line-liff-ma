"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminGet } from "@/app/admin/apiClient";
import { cn } from "@/lib/utils";

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

export default function TicketsListPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["tickets", { status: statusFilter }],
    queryFn: () =>
      adminGet<{ tickets: TicketListItem[] }>(
        `/api/tickets${statusFilter ? `?status=${statusFilter}` : ""}`,
      ),
  });

  const tickets = useMemo(() => data?.tickets ?? [], [data]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ใบแจ้งซ่อม</h1>
          <p className="text-sm text-muted-foreground mt-1">รายการใบแจ้งซ่อมทั้งหมด</p>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="ทุกสถานะ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">ทุกสถานะ</SelectItem>
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="w-5 h-5 animate-spin" /> <span>กำลังโหลด...</span>
        </div>
      )}

      {data && (
        <div className="card-default overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>เลขที่ใบแจ้ง</TableHead>
                <TableHead>รถ</TableHead>
                <TableHead>ลูกค้า</TableHead>
                <TableHead>ช่างผู้รับผิดชอบ</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>วันที่แจ้ง</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  className="hover:bg-muted/40 cursor-pointer"
                  onClick={() => router.push(`/admin/tickets/${ticket.id}`)}
                >
                  <TableCell className="font-mono font-medium">{ticket.ticketNo}</TableCell>
                  <TableCell>{ticket.asset.assetCode}</TableCell>
                  <TableCell>{ticket.customer.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {ticket.assignee?.displayName ?? "-"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "badge-status",
                        STATUS_CLASS[ticket.status] ?? "bg-muted text-muted-foreground",
                      )}
                    >
                      {STATUS_LABEL[ticket.status] ?? ticket.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(ticket.reportedAt).toLocaleString("th-TH")}
                  </TableCell>
                </TableRow>
              ))}
              {tickets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    ไม่มีใบแจ้งซ่อม
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
