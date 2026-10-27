"use client";

export interface ApiErrorBody {
  statusCode: number;
  errorCode: string;
  message: string;
  details?: unknown;
}

export class ApiClientError extends Error {
  readonly errorCode: string;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiClientError";
    this.errorCode = body.errorCode;
    this.statusCode = body.statusCode;
    this.details = body.details;
  }
}

let refreshPromise: Promise<boolean> | null = null;

/** เรียก /api/auth/refresh ครั้งเดียวแม้มีหลาย request 401 พร้อมกัน (dedupe ผ่าน promise เดียวกัน) */
async function tryRefreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth/refresh", { method: "POST" })
      .then((res) => res.ok)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/**
 * fetch wrapper กลางสำหรับ admin API
 * - แนบ credentials (cookie) เสมอ
 * - ถ้าได้ 401 ลอง refresh session แล้ว retry คำขอเดิมครั้งเดียว
 * - แปลง error response เป็น ApiClientError เสมอ
 */
export async function adminFetch<T>(
  path: string,
  init?: RequestInit,
  _retried = false,
): Promise<T> {
  const res = await fetch(path, { ...init, credentials: "same-origin" });

  if (res.status === 401 && !_retried) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      return adminFetch<T>(path, init, true);
    }
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiClientError(
      data ?? { statusCode: res.status, errorCode: "INTERNAL_ERROR", message: "เกิดข้อผิดพลาด" },
    );
  }

  return data as T;
}

export function adminGet<T>(path: string): Promise<T> {
  return adminFetch<T>(path, { method: "GET" });
}

export function adminPost<T>(path: string, body?: unknown): Promise<T> {
  return adminFetch<T>(path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function adminPatch<T>(path: string, body?: unknown): Promise<T> {
  return adminFetch<T>(path, {
    method: "PATCH",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function adminPostForm<T>(path: string, formData: FormData): Promise<T> {
  return adminFetch<T>(path, { method: "POST", body: formData });
}
