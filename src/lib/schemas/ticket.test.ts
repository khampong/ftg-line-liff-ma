import { describe, expect, it } from "vitest";
import { createTicketFromLiffSchema } from "@/lib/schemas/ticket";

describe("createTicketFromLiffSchema", () => {
  it("accepts a valid submission with one symptom category and no description", () => {
    const result = createTicketFromLiffSchema.safeParse({
      assetToken: "abc123",
      symptomCategories: ["ENGINE_NO_START"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts multiple symptom categories", () => {
    const result = createTicketFromLiffSchema.safeParse({
      assetToken: "abc123",
      symptomCategories: ["ENGINE_NO_START", "BRAKE"],
      description: "เสียงแปลกๆตอนเบรก",
    });
    expect(result.success).toBe(true);
  });

  it("rejects submission with no symptom categories (Req 3.4)", () => {
    const result = createTicketFromLiffSchema.safeParse({
      assetToken: "abc123",
      symptomCategories: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects submission missing assetToken", () => {
    const result = createTicketFromLiffSchema.safeParse({
      assetToken: "",
      symptomCategories: ["BRAKE"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown symptom category values", () => {
    const result = createTicketFromLiffSchema.safeParse({
      assetToken: "abc123",
      symptomCategories: ["NOT_A_REAL_CATEGORY"],
    });
    expect(result.success).toBe(false);
  });

  it("requires description when OTHER is selected (Req 3.2)", () => {
    const result = createTicketFromLiffSchema.safeParse({
      assetToken: "abc123",
      symptomCategories: ["OTHER"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts OTHER when description is provided", () => {
    const result = createTicketFromLiffSchema.safeParse({
      assetToken: "abc123",
      symptomCategories: ["OTHER"],
      description: "เสียงดังผิดปกติที่ล้อหลัง",
    });
    expect(result.success).toBe(true);
  });

  it("still requires description for OTHER even when combined with other categories", () => {
    const result = createTicketFromLiffSchema.safeParse({
      assetToken: "abc123",
      symptomCategories: ["BRAKE", "OTHER"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects description longer than 2000 characters", () => {
    const result = createTicketFromLiffSchema.safeParse({
      assetToken: "abc123",
      symptomCategories: ["BRAKE"],
      description: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});
