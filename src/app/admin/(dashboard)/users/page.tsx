"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Pencil, Ban, CheckCircle } from "lucide-react";
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
import { adminGet, adminPatch, adminPost, ApiClientError } from "@/app/admin/apiClient";

interface UserItem {
  id: string;
  username: string;
  displayName: string;
  role: "ADMIN" | "TECHNICIAN" | "MANAGER";
  active: boolean;
}

interface UserFormState {
  username: string;
  displayName: string;
  role: "ADMIN" | "TECHNICIAN" | "MANAGER";
  password: string;
}

const EMPTY_FORM: UserFormState = {
  username: "",
  displayName: "",
  role: "TECHNICIAN",
  password: "",
};

const ROLE_LABEL: Record<UserFormState["role"], string> = {
  ADMIN: "แอดมิน",
  TECHNICIAN: "ช่าง",
  MANAGER: "ผู้บริหาร",
};

const ROLE_CLASS: Record<UserFormState["role"], string> = {
  ADMIN: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400",
  TECHNICIAN: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  MANAGER: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => adminGet<{ users: UserItem[] }>("/api/users"),
  });

  const createMutation = useMutation({
    mutationFn: (input: UserFormState) => adminPost("/api/users", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      closeDialog();
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : "บันทึกไม่สำเร็จ"),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<UserFormState> }) =>
      adminPatch(`/api/users/${id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      closeDialog();
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : "บันทึกไม่สำเร็จ"),
  });
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      adminPatch(`/api/users/${id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const openCreateDialog = () => {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  };
  const openEditDialog = (u: UserItem) => {
    setEditingUser(u);
    setForm({ username: u.username, displayName: u.displayName, role: u.role, password: "" });
    setFormError(null);
    setDialogOpen(true);
  };
  const closeDialog = () => setDialogOpen(false);

  const handleSubmit = () => {
    if (editingUser) {
      const input: Partial<UserFormState> = { displayName: form.displayName, role: form.role };
      if (form.password) input.password = form.password;
      updateMutation.mutate({ id: editingUser.id, input });
      return;
    }
    if (!form.username.trim() || !form.password.trim()) {
      setFormError("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }
    createMutation.mutate(form);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">จัดการผู้ใช้งาน</h1>
          <p className="text-sm text-muted-foreground mt-1">จัดการบัญชีและสิทธิ์ผู้ใช้งาน</p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="w-4 h-4" /> เพิ่มผู้ใช้
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
                <TableHead>ชื่อผู้ใช้</TableHead>
                <TableHead>ชื่อที่แสดง</TableHead>
                <TableHead>สิทธิ์</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">การจัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.users.map((user) => (
                <TableRow key={user.id} className="hover:bg-muted/40">
                  <TableCell className="font-mono">{user.username}</TableCell>
                  <TableCell className="font-medium">{user.displayName}</TableCell>
                  <TableCell>
                    <span className={`badge-status ${ROLE_CLASS[user.role]}`}>
                      {ROLE_LABEL[user.role]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`badge-status ${user.active ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400" : "bg-muted text-muted-foreground"}`}
                    >
                      {user.active ? "ใช้งาน" : "ปิดใช้งาน"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(user)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 ${user.active ? "text-destructive hover:text-destructive" : "text-green-600 hover:text-green-600"}`}
                        onClick={() =>
                          toggleActiveMutation.mutate({ id: user.id, active: !user.active })
                        }
                      >
                        {user.active ? (
                          <Ban className="w-4 h-4" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>ชื่อผู้ใช้ (username)</Label>
              <Input
                placeholder="username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                disabled={Boolean(editingUser)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>ชื่อที่แสดง</Label>
              <Input
                placeholder="ชื่อที่แสดง"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>สิทธิ์</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as UserFormState["role"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{editingUser ? "รหัสผ่านใหม่ (ว่างถ้าไม่เปลี่ยน)" : "รหัสผ่าน"}</Label>
              <Input
                type="password"
                placeholder={editingUser ? "ว่างถ้าไม่เปลี่ยน" : "รหัสผ่าน (อย่างน้อย 8 ตัว)"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
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
