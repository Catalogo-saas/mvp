import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ merchant: vi.fn(), query: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/merchant", () => ({ getMerchantStore: mocks.merchant }));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: mocks.query, order: { count: mocks.count } } }));
import { POST } from "../app/api/admin/orders/[orderId]/read/route";
import { GET } from "../app/api/admin/orders/unread/route";
const request = new Request("http://localhost/api/admin/orders/order-a/read", { method: "POST" });
const context = { params: Promise.resolve({ orderId: "order-a" }) };
beforeEach(() => { vi.clearAllMocks(); mocks.merchant.mockResolvedValue({ id: "tenant-a" }); mocks.query.mockResolvedValue([{ readAt: new Date("2026-09-29T01:00:00Z") }]); mocks.count.mockResolvedValue(2); });
describe("lectura de ventas aislada del estado comercial", () => {
  it("requiere autenticación en lectura y contador", async () => {
    mocks.merchant.mockResolvedValue(null);
    expect((await POST(request, context)).status).toBe(401);
    expect((await GET()).status).toBe(401);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("actualiza únicamente readAt y conserva la primera lectura", async () => {
    const response = await POST(request, context);
    expect(await response.json()).toEqual({ readAt: "2026-09-29T01:00:00.000Z", count: 2 });
    const [template, ...parameters] = mocks.query.mock.calls[0];
    const sql = template.join("?");
    expect(sql).toContain('SET "readAt" = COALESCE("readAt", CURRENT_TIMESTAMP)');
    expect(sql).not.toMatch(/updatedAt|stock|status|OrderEvent/);
    expect(parameters).toEqual(["order-a", "tenant-a"]);
  });
  it("no permite leer una venta ajena o inexistente", async () => {
    mocks.query.mockResolvedValue([]);
    expect((await POST(request, context)).status).toBe(404);
    expect(mocks.count).not.toHaveBeenCalled();
  });
  it("cuenta todas las no leídas del tenant sin filtros comerciales ni caché", async () => {
    const response = await GET();
    expect(await response.json()).toEqual({ count: 2 });
    expect(mocks.count).toHaveBeenCalledWith({ where: { storeId: "tenant-a", readAt: null } });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});
