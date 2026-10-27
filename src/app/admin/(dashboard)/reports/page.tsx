"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Icon } from "@iconify/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminGet } from "@/app/admin/apiClient";

interface SummaryResponse {
  total: number;
  byStatus: Record<string, number>;
}
interface TopAssetsResponse {
  topAssets: { asset: { assetCode: string; model: string | null } | null; ticketCount: number }[];
  topCustomers: { customer: { name: string } | null; ticketCount: number }[];
}
interface AvgResolutionResponse {
  averageResolutionHours: number | null;
  sampleSize: number;
}

// STATUS_LABEL ไม่ใช้ใน reports page โดยตรง (ใช้ใน SUMMARY_CARDS แทน) ลบออก

const SUMMARY_CARDS = [
  {
    key: "total",
    label: "ทั้งหมด",
    icon: "solar:document-text-linear",
    color: "text-primary bg-primary/10",
  },
  {
    key: "NEW",
    label: "แจ้งใหม่",
    icon: "solar:bell-linear",
    color: "text-blue-500 bg-blue-500/10",
  },
  {
    key: "ACCEPTED",
    label: "รับเรื่อง",
    icon: "solar:check-read-linear",
    color: "text-yellow-500 bg-yellow-500/10",
  },
  {
    key: "IN_PROGRESS",
    label: "กำลังซ่อม",
    icon: "solar:settings-linear",
    color: "text-orange-500 bg-orange-500/10",
  },
  {
    key: "REPAIRED",
    label: "ซ่อมเสร็จ",
    icon: "solar:verified-check-linear",
    color: "text-green-600 bg-green-500/10",
  },
  {
    key: "CLOSED",
    label: "ปิดงาน",
    icon: "solar:lock-linear",
    color: "text-muted-foreground bg-muted",
  },
];

export default function ReportsPage() {
  const { data: summary, isLoading: l1 } = useQuery({
    queryKey: ["reports", "summary"],
    queryFn: () => adminGet<SummaryResponse>("/api/reports/summary"),
  });
  const { data: topData, isLoading: l2 } = useQuery({
    queryKey: ["reports", "top-assets"],
    queryFn: () => adminGet<TopAssetsResponse>("/api/reports/top-assets"),
  });
  const { data: avgData, isLoading: l3 } = useQuery({
    queryKey: ["reports", "avg-resolution"],
    queryFn: () => adminGet<AvgResolutionResponse>("/api/reports/avg-resolution"),
  });

  const isLoading = l1 || l2 || l3;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">รายงานและสถิติ</h1>
        <p className="text-sm text-muted-foreground mt-1">ภาพรวมสถิติการแจ้งซ่อม</p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="w-5 h-5 animate-spin" /> <span>กำลังโหลด...</span>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {SUMMARY_CARDS.map(({ key, label, icon, color }) => {
            const count = key === "total" ? summary.total : (summary.byStatus[key] ?? 0);
            return (
              <div key={key} className="card-default p-4">
                <div
                  className={`inline-flex items-center justify-center w-9 h-9 rounded-lg mb-3 ${color}`}
                >
                  <Icon icon={icon} width={18} />
                </div>
                <p className="text-2xl font-bold text-foreground">{count}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Avg resolution card */}
      {avgData !== undefined && (
        <div className="card-default p-5 mb-6 flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary shrink-0">
            <Icon icon="solar:clock-circle-linear" width={24} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">เวลาเฉลี่ยดำเนินการ</p>
            <p className="text-2xl font-bold text-foreground">
              {avgData.averageResolutionHours != null
                ? `${avgData.averageResolutionHours} ชั่วโมง`
                : "-"}
            </p>
            <p className="text-xs text-muted-foreground">
              คำนวณจากใบที่ปิดแล้ว {avgData.sampleSize} ใบ
            </p>
          </div>
        </div>
      )}

      {/* Top tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-default overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-foreground">รถที่แจ้งซ่อมบ่อยที่สุด</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>รหัสรถ</TableHead>
                <TableHead>รุ่น</TableHead>
                <TableHead className="text-right">จำนวนครั้ง</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(topData?.topAssets ?? []).map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono">{row.asset?.assetCode ?? "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{row.asset?.model ?? "-"}</TableCell>
                  <TableCell className="text-right font-semibold">{row.ticketCount}</TableCell>
                </TableRow>
              ))}
              {(topData?.topAssets ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                    ไม่มีข้อมูล
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="card-default overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-foreground">ลูกค้าที่แจ้งซ่อมบ่อยที่สุด</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ลูกค้า</TableHead>
                <TableHead className="text-right">จำนวนครั้ง</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(topData?.topCustomers ?? []).map((row, i) => (
                <TableRow key={i}>
                  <TableCell>{row.customer?.name ?? "-"}</TableCell>
                  <TableCell className="text-right font-semibold">{row.ticketCount}</TableCell>
                </TableRow>
              ))}
              {(topData?.topCustomers ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground py-6">
                    ไม่มีข้อมูล
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
