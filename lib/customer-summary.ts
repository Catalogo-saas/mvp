export type CustomerOrderInput = {
  code: string;
  customerName: string;
  customerPhone: string;
  total: number;
  createdAt: Date | string;
};

export type CustomerSummary = {
  id: string;
  name: string;
  phone: string;
  normalizedPhone: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string;
  lastOrderCode: string;
};

export const validCustomerOrderStatuses = ["PAID", "IN_PREPARATION", "DELIVERED"] as const;

export function isValidCustomerOrderStatus(status: string) {
  return validCustomerOrderStatuses.includes(status as (typeof validCustomerOrderStatuses)[number]);
}

export function normalizeCustomerPhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export function aggregateCustomers(orders: CustomerOrderInput[]) {
  const customers = new Map<string, CustomerSummary>();

  for (const order of orders) {
    const normalizedPhone = normalizeCustomerPhone(order.customerPhone);
    const id = normalizedPhone || order.customerPhone.trim().toLowerCase();
    const createdAt = typeof order.createdAt === "string" ? order.createdAt : order.createdAt.toISOString();
    const existing = customers.get(id);

    if (!existing) {
      customers.set(id, {
        id,
        name: order.customerName,
        phone: order.customerPhone,
        normalizedPhone,
        orderCount: 1,
        totalSpent: order.total,
        lastOrderAt: createdAt,
        lastOrderCode: order.code
      });
      continue;
    }

    existing.orderCount += 1;
    existing.totalSpent += order.total;
    if (Date.parse(createdAt) > Date.parse(existing.lastOrderAt)) {
      existing.name = order.customerName;
      existing.phone = order.customerPhone;
      existing.lastOrderAt = createdAt;
      existing.lastOrderCode = order.code;
    }
  }

  return Array.from(customers.values()).sort((left, right) => Date.parse(right.lastOrderAt) - Date.parse(left.lastOrderAt));
}
