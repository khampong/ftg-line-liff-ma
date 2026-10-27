import { z } from "zod";

export const assignTicketSchema = z.object({
  assigneeId: z.string().uuid("assigneeId ไม่ถูกต้อง"),
});

export type AssignTicketInput = z.infer<typeof assignTicketSchema>;

export const ticketStatusSchema = z.enum([
  "NEW",
  "ACCEPTED",
  "IN_PROGRESS",
  "REPAIRED",
  "CLOSED",
  "CANCELLED",
]);

export const updateTicketStatusSchema = z.object({
  status: ticketStatusSchema,
  /** บังคับกรอกก่อนเปลี่ยนเป็น REPAIRED (Req 7.3) */
  repairNote: z.string().trim().min(1).max(2000).optional(),
  note: z.string().trim().max(500).optional(),
});

export type UpdateTicketStatusInput = z.infer<typeof updateTicketStatusSchema>;

export const ticketListQuerySchema = z.object({
  status: ticketStatusSchema.optional(),
  customerId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type TicketListQuery = z.infer<typeof ticketListQuerySchema>;
