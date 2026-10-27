import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * รหัส error กลางของระบบ ใช้ตรงกันทั้ง LIFF และ Admin API
 * อ้างอิง design.md > Error Handling
 */
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "NOT_FRIEND"
  | "INVALID_QR"
  | "QR_REVOKED"
  | "INVALID_TRANSITION"
  | "UPLOAD_FAILED"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  NOT_FRIEND: 403,
  INVALID_QR: 404,
  QR_REVOKED: 404,
  INVALID_TRANSITION: 409,
  UPLOAD_FAILED: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

/**
 * Error รูปแบบมาตรฐานของ API: { statusCode, errorCode, message }
 * throw ตัวนี้ใน service/route handler แล้วให้ toErrorResponse จับแปลงเป็น NextResponse
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly errorCode: ApiErrorCode;
  readonly details?: unknown;

  constructor(errorCode: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.errorCode = errorCode;
    this.statusCode = STATUS_BY_CODE[errorCode];
    this.details = details;
  }
}

interface ApiErrorBody {
  statusCode: number;
  errorCode: ApiErrorCode;
  message: string;
  details?: unknown;
}

export function toErrorResponse(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        statusCode: error.statusCode,
        errorCode: error.errorCode,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
      { status: error.statusCode },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        statusCode: 400,
        errorCode: "VALIDATION_ERROR" as const,
        message: "ข้อมูลที่ส่งมาไม่ถูกต้อง",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  // ไม่คาดคิด: log ไว้ฝั่ง server แต่ไม่ leak รายละเอียดกลับ client
  console.error("Unhandled API error:", error);
  return NextResponse.json(
    {
      statusCode: 500,
      errorCode: "INTERNAL_ERROR" as const,
      message: "เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง",
    },
    { status: 500 },
  );
}

/**
 * Wrap route handler เพื่อจับ error อัตโนมัติ ลด try/catch ซ้ำๆในทุก route
 * ใช้: export const GET = withErrorHandling(async (req) => { ... });
 */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
