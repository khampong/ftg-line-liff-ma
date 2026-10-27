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

async function parseResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiClientError(
      data ?? { statusCode: res.status, errorCode: "INTERNAL_ERROR", message: "เกิดข้อผิดพลาด" },
    );
  }
  return data as T;
}

export interface AssetContextResponse {
  asset: { assetCode: string; model: string | null; location: string | null };
  customer: { name: string | null; location: string | null };
  reporter: { lineUserId: string; displayName: string; pictureUrl: string | null };
}

/** GET /api/liff/assets/[token] — ดูบริบทรถจาก QR token */
export async function fetchAssetContext(
  token: string,
  accessToken: string,
): Promise<AssetContextResponse> {
  const res = await fetch(`/api/liff/assets/${encodeURIComponent(token)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseResponse<AssetContextResponse>(res);
}

export interface CreateTicketResponse {
  ticket: { id: string; ticketNo: string; reportedAt: string };
}

export interface CreateTicketPayload {
  assetToken: string;
  symptomCategories: string[];
  description?: string;
  images: File[];
}

/** POST /api/liff/tickets — ส่งฟอร์มแจ้งซ่อม */
export async function submitTicket(
  payload: CreateTicketPayload,
  accessToken: string,
): Promise<CreateTicketResponse> {
  const formData = new FormData();
  formData.set("assetToken", payload.assetToken);
  for (const category of payload.symptomCategories) {
    formData.append("symptomCategories", category);
  }
  if (payload.description) {
    formData.set("description", payload.description);
  }
  for (const image of payload.images) {
    formData.append("images", image);
  }

  const res = await fetch("/api/liff/tickets", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  return parseResponse<CreateTicketResponse>(res);
}
