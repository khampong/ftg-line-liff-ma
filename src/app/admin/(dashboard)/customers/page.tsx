"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Pencil, Ban } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminGet, adminPatch, adminPost, ApiClientError } from "@/app/admin/apiClient";

interface Customer {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  address: string | null;
  location: string | null;
  active: boolean;
}

interface CustomerFormState {
  name: string;
  contactName: string;
  phone: string;
  address: string;
  location: string;
}

const EMPTY_FORM: CustomerFormState = {
  name: "",
  contactName: "",
  phone: "",
  address: "",
  location: "",
};

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: () => adminGet<{ customers: Customer[] }>("/api/customers"),
  });

  const createMutation = useMutation({
    mutationFn: (input: CustomerFormState) =>
      adminPost("/api/customers", {
        name: input.name,
        contactName: input.contactName || undefined,
        phone: input.phone || undefined,
        address: input.address || undefined,
        location: input.location || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      closeDialog();
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : "บันทึกไม่สำเร็จ"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CustomerFormState }) =>
      adminPatch(`/api/customers/${id}`, {
        name: input.name,
        contactName: input.contactName || undefined,
        phone: input.phone || undefined,
        address: input.address || undefined,
        location: input.location || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      closeDialog();
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : "บันทึกไม่สำเร็จ"),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => adminPatch(`/api/customers/${id}/deactivate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });

  const openCreateDialog = () => {
    setEditingCustomer(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  };
  const openEditDialog = (c: Customer) => {
    setEditingCustomer(c);
    setForm({
      name: c.name,
      contactName: c.contactName ?? "",
      phone: c.phone ?? "",
      address: c.address ?? "",
      location: c.location ?? "",
    });
    setFormError(null);
    setDialogOpen(true);
  };
  const closeDialog = () => setDialogOpen(false);

  const handleSubmit = () => {
    if (!form.name.trim()) {
      setFormError("กรุณากรอกชื่อลูกค้า");
      return;
    }
    if (editingCustomer) updateMutation.mutate({ id: editingCustomer.id, input: form });
    else createMutation.mutate(form);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">จัดการลูกค้า</h1>
          <p className="text-sm text-muted-foreground mt-1">เพิ่ม แก้ไข และจัดการข้อมูลลูกค้า</p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="w-4 h-4" /> เพิ่มลูกค้า
        </Button>
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
                <TableHead>ชื่อลูกค้า</TableHead>
                <TableHead>ผู้ติดต่อ</TableHead>
                <TableHead>เบอร์โทร</TableHead>
                <TableHead>สถานที่</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">การจัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.customers.map((customer) => (
                <TableRow key={customer.id} className="hover:bg-muted/40">
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {customer.contactName ?? "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{customer.phone ?? "-"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {customer.location ?? "-"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`badge-status ${customer.active ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400" : "bg-muted text-muted-foreground"}`}
                    >
                      {customer.active ? "ใช้งาน" : "ปิดใช้งาน"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(customer)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {customer.active && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deactivateMutation.mutate(customer.id)}
                        >
                          <Ban className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {data.customers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    ยังไม่มีข้อมูลลูกค้า
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "แก้ไขลูกค้า" : "เพิ่มลูกค้า"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>
                ชื่อลูกค้า <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="กรอกชื่อลูกค้า"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>ผู้ติดต่อ</Label>
              <Input
                placeholder="ชื่อผู้ติดต่อ"
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>เบอร์โทร</Label>
              <Input
                placeholder="เบอร์โทรศัพท์"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>ที่อยู่</Label>
              <Input
                placeholder="ที่อยู่"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>สถานที่ตั้ง</Label>
              <Input
                placeholder="สถานที่ตั้ง"
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
    </div>
  );
}
