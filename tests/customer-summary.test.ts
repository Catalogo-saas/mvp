import { describe, expect, it } from "vitest";

import { aggregateCustomers, isValidCustomerOrderStatus, normalizeCustomerPhone } from "../lib/customer-summary";

describe("customer summaries", () => {
  it("normalizes phone formatting", () => {
    expect(normalizeCustomerPhone("+54 9 11 5555-1234")).toBe("5491155551234");
  });

  it("groups orders and keeps the most recent customer data", () => {
    const customers = aggregateCustomers([
      { code: "001", customerName: "Ana", customerPhone: "+54 9 11 5555-1234", total: 1000, createdAt: "2026-01-01T10:00:00.000Z" },
      { code: "002", customerName: "Ana Pérez", customerPhone: "+54 (9) 11 5555 1234", total: 2500, createdAt: "2026-02-01T10:00:00.000Z" }
    ]);
    expect(customers).toHaveLength(1);
    expect(customers[0]).toMatchObject({ name: "Ana Pérez", orderCount: 2, totalSpent: 3500, lastOrderCode: "002" });
  });

  it("only accepts paid, preparing or delivered orders as customer purchases", () => {
    expect(["PAID", "IN_PREPARATION", "DELIVERED"].every(isValidCustomerOrderStatus)).toBe(true);
    expect(isValidCustomerOrderStatus("PENDING_WHATSAPP")).toBe(false);
    expect(isValidCustomerOrderStatus("CANCELLED")).toBe(false);
  });
});
