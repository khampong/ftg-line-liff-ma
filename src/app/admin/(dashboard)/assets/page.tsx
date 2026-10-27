"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Pencil, Ban, QrCode, Download, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { adminGet, adminPatch, adminPost, ApiClientError } from "@/app/admin/apiClient";

interface Customer {
  id: string;
  name: string;
}
interface Asset {
  id: string;
  assetCode: string;
  model: string | null;
  serialNo: string | null;
  location: string | null;
  active: boolean;
  customer: { id: string; name: string };
}
interface AssetFormState {
  customerId: string;
  assetCode: string;
  model: string;
  serialNo: string;
  location: string;
}

const EMPTY_FORM: AssetFormState = {
  customerId: "",
  assetCode: "",
  model: "",
  serialNo: "",
  location: "",
};

export default function AssetsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrDialogAsset, setQrDialogAsset] = useState<Asset | null>(null);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [form, setForm] = useState<AssetFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [qrCacheBuster, setQrCacheBuster] = useState(0);
  const [rotateSuccess, setRotateSuccess] = useState(false);

  const { data: assetsData, isLoading } = useQuery({
    queryKey: ["assets"],
    queryFn: () => adminGet<{ assets: Asset[] }>("/api/assets"),
  });
  const { data: customersData } = useQuery({
    queryKey: ["customers"],
    queryFn: () => adminGet<{ customers: Customer[] }>("/api/customers"),
  });

  const createMutation = useMutation({
    mutationFn: (input: AssetFormState) =>
      adminPost("/api/assets", {
        customerId: input.customerId,
        assetCode: input.assetCode,
        model: input.model || undefined,
        serialNo: input.serialNo || undefined,
        location: input.location || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      closeDialog();
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : "บันทึกไม่สำเร็จ"),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: AssetFormState }) =>
      adminPatch(`/api/assets/${id}`, {
        customerId: input.customerId,
        assetCode: input.assetCode,
        model: input.model || undefined,
        serialNo: input.serialNo || undefined,
        location: input.location || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      closeDialog();
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : "บันทึกไม่สำเร็จ"),
  });
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => adminPatch(`/api/assets/${id}/deactivate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["assets"] }),
  });
  const rotateMutation = useMutation({
    mutationFn: (id: string) => adminPost<{ liffUrl: string }>(`/api/assets/${id}/qr/rotate`),
    onSuccess: () => {
      setQrCacheBuster((n) => n + 1);
      setRotateSuccess(true);
    },
  });

  const openCreateDialog = () => {
    setEditingAsset(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  };
  const openEditDialog = (a: Asset) => {
    setEditingAsset(a);
    setForm({
      customerId: a.customer.id,
      assetCode: a.assetCode,
      model: a.model ?? "",
      serialNo: a.serialNo ?? "",
      location: a.location ?? "",
    });
    setFormError(null);
    setDialogOpen(true);
  };
  const closeDialog = () => setDialogOpen(false);
  const openQrDialog = (a: Asset) => {
    setQrDialogAsset(a);
    setRotateSuccess(false);
  };

  const handleSubmit = () => {
    if (!form.customerId) {
      setFormError("กรุณาเลือกลูกค้า");
      return;
    }
    if (!form.assetCode.trim()) {
      setFormError("กรุณากรอกรหัสรถ");
      return;
    }
    if (editingAsset) updateMutation.mutate({ id: editingAsset.id, input: form });
    else createMutation.mutate(form);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const customers = customersData?.customers ?? [];

  return (
    <TooltipProvider>
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">จัดการรถโฟล์คลิฟท์</h1>
            <p className="text-sm text-muted-foreground mt-1">จัดการข้อมูลรถและ QR Code</p>
          </div>
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="w-4 h-4" /> เพิ่มรถ
          </Button>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground py-8">
            <Loader2 className="w-5 h-5 animate-spin" /> <span>กำลังโหลด...</span>
          </div>
        )}

        {assetsData && (
          <div className="card-default overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>รหัสรถ</TableHead>
                  <TableHead>รุ่น</TableHead>
                  <TableHead>ลูกค้า</TableHead>
                  <TableHead>สถานที่</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">การจัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assetsData.assets.map((asset) => (
                  <TableRow key={asset.id} className="hover:bg-muted/40">
                    <TableCell className="font-medium">{asset.assetCode}</TableCell>
                    <TableCell className="text-muted-foreground">{asset.model ?? "-"}</TableCell>
                    <TableCell>{asset.customer.name}</TableCell>
                    <TableCell className="text-muted-foreground">{asset.location ?? "-"}</TableCell>
                    <TableCell>
                      <span
                        className={`badge-status ${asset.active ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400" : "bg-muted text-muted-foreground"}`}
                      >
                        {asset.active ? "ใช้งาน" : "ปิดใช้งาน"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openQrDialog(asset)}
                            >
                              <QrCode className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>QR Code</TooltipContent>
                        </Tooltip>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(asset)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {asset.active && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => deactivateMutation.mutate(asset.id)}
                          >
                            <Ban className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {assetsData.assets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                      ยังไม่มีข้อมูลรถ
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Asset form dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingAsset ? "แก้ไขรถ" : "เพิ่มรถ"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>
                  ลูกค้า <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.customerId}
                  onValueChange={(v) => setForm({ ...form, customerId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกลูกค้า" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>
                  รหัสรถ <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="เช่น FL-0001"
                  value={form.assetCode}
                  onChange={(e) => setForm({ ...form, assetCode: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>รุ่น</Label>
                <Input
                  placeholder="รุ่นรถ"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>หมายเลขเครื่อง</Label>
                <Input
                  placeholder="Serial No."
                  value={form.serialNo}
                  onChange={(e) => setForm({ ...form, serialNo: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>สถานที่ตั้ง</Label>
                <Input
                  placeholder="สถานที่ตั้งรถ"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
              {formError && (
                <Alert variant="destructive">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>
                ยกเลิก
              </Button>
              <Button onClick={handleSubmit} disabled={isSaving} className="gap-2">
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />} บันทึก
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* QR dialog */}
        <Dialog
          open={Boolean(qrDialogAsset)}
          onOpenChange={(open) => !open && setQrDialogAsset(null)}
        >
          <DialogContent className="max-w-xs">
            <DialogHeader>
              <DialogTitle>QR Code: {qrDialogAsset?.assetCode}</DialogTitle>
            </DialogHeader>
            {qrDialogAsset && (
              <div className="flex flex-col items-center gap-4 py-2">
                <img
                  src={`/api/assets/${qrDialogAsset.id}/qr?v=${qrCacheBuster}`}
                  alt="QR code"
                  className="w-48 h-48 rounded-lg border border-border"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <p className="text-xs text-muted-foreground text-center">
                  ถ้าไม่เห็นรูป กด &quot;ออก QR ใหม่&quot; ก่อน
                </p>
                <div className="flex gap-2 w-full">
                  <Button variant="outline" className="flex-1 gap-1.5" asChild>
                    <a href={`/api/assets/${qrDialogAsset.id}/qr?v=${qrCacheBuster}`} download>
                      <Download className="w-4 h-4" /> PNG
                    </a>
                  </Button>
                  <Button variant="outline" className="flex-1 gap-1.5" asChild>
                    <a href={`/api/assets/${qrDialogAsset.id}/qr?format=pdf`} download>
                      <FileText className="w-4 h-4" /> PDF
                    </a>
                  </Button>
                </div>
                <Button
                  variant="destructive"
                  className="w-full gap-2"
                  onClick={() => rotateMutation.mutate(qrDialogAsset.id)}
                  disabled={rotateMutation.isPending}
                >
                  {rotateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  ออก QR ใหม่ (ยกเลิกอันเดิม)
                </Button>
                {rotateSuccess && (
                  <Alert>
                    <AlertDescription>
                      ออก QR ใหม่สำเร็จ กรุณาปิดและเปิดหน้าต่างนี้ใหม่เพื่อดู QR ล่าสุด
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setQrDialogAsset(null)}>
                ปิด
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
