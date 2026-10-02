import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), user: vi.fn(), store: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: mocks.user }, store: { findFirst: mocks.store } } }));
import { getAuthenticatedUser, getMerchantContext, getMerchantStore } from "../lib/merchant";

const user = { id: "member", name: "Miembro", email: "member@test.example", role: "MERCHANT", status: "ACTIVE", authVersion: 0 };
beforeEach(() => {
  vi.clearAllMocks(); mocks.session.mockResolvedValue({ user: { id: "member", authVersion: 0 } });
  mocks.user.mockResolvedValue(user);
  mocks.store.mockResolvedValue({ id: "store", ownerId: "owner", members: [{ role: "OPERATOR" }] });
});
describe("autenticación del equipo", () => {
  it("resuelve la tienda y el rol de un miembro", async () => {
    expect(await getMerchantContext()).toMatchObject({ role: "OPERATOR", store: { id: "store" } });
    expect(mocks.store.mock.calls[0][0].where).toEqual({ owner: { role: "MERCHANT", status: "ACTIVE" }, OR: [{ ownerId: "member" }, { members: { some: { userId: "member" } } }] });
    expect(await getMerchantStore()).not.toHaveProperty("members");
  });
  it("titulares existentes no necesitan membresías", async () => {
    mocks.store.mockResolvedValue({ id: "store", ownerId: "member", members: [] });
    expect(await getMerchantContext()).toMatchObject({ role: "OWNER" });
  });
  it("conserva sesiones existentes con versión cero", async () => {
    mocks.session.mockResolvedValue({ user: { id: "member" } });
    expect(await getAuthenticatedUser()).toEqual(user);
  });
  it("revoca un JWT anterior incluso si la cuenta se reactiva", async () => {
    mocks.user.mockResolvedValue({ ...user, authVersion: 1 });
    expect(await getAuthenticatedUser()).toBeNull(); expect(await getMerchantContext()).toBeNull();
  });
  it("acepta una nueva sesión con la versión vigente", async () => {
    mocks.user.mockResolvedValue({ ...user, authVersion: 2 });
    mocks.session.mockResolvedValue({ user: { id: "member", authVersion: 2 } });
    expect(await getAuthenticatedUser()).toMatchObject({ id: "member" });
  });
  it("bloquea usuarios suspendidos y tiendas inaccesibles", async () => {
    mocks.user.mockResolvedValueOnce({ ...user, status: "SUSPENDED" });
    expect(await getMerchantContext()).toBeNull();
    mocks.store.mockResolvedValueOnce(null);
    expect(await getMerchantContext()).toBeNull();
  });
  it("el rol global superadmin no concede acceso a tiendas", async () => {
    mocks.user.mockResolvedValue({ ...user, role: "SUPER_ADMIN" });
    expect(await getMerchantContext()).toBeNull(); expect(mocks.store).not.toHaveBeenCalled();
  });
});
