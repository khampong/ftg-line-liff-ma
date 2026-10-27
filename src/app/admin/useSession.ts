"use client";

import { useQuery } from "@tanstack/react-query";
import { adminGet } from "@/app/admin/apiClient";

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  role: "ADMIN" | "TECHNICIAN" | "MANAGER";
  active: boolean;
}

/** ดึงข้อมูลผู้ใช้ปัจจุบันจาก /api/auth/me ใช้แสดง/ซ่อน UI ตาม role (UX เท่านั้น backend คือ source of truth) */
export function useSession() {
  return useQuery({
    queryKey: ["session", "me"],
    queryFn: () => adminGet<{ user: SessionUser }>("/api/auth/me"),
    retry: false,
    staleTime: 60_000,
  });
}
