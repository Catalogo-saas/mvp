import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), context: vi.fn(), create: vi.fn(), update: vi.fn(), owner: vi.fn(),
  count: vi.fn(), members: vi.fn(), member: vi.fn(), updateMember: vi.fn(), hash: vi.fn(), presign: vi.fn() }));
vi.mock("@/lib/merchant", () => ({ getAuthenticatedUser: mocks.auth, getMerchantContext: mocks.context }));
vi.mock("bcryptjs", () => ({ default: { hash: mocks.hash } }));
vi.mock("@/lib/storage", () => ({ createPresignedUploadUrl: mocks.presign }));
vi.mock("@/lib/image-uploads", () => ({ createPendingImageKey: () => "pending/store-a/products/test.webp", resolveImageReferences: vi.fn(), deletePromotedImages: vi.fn(), deletePromotedTemporaries: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const tx = { user: { create: mocks.create, update: mocks.update, findUniqueOrThrow: mocks.owner },
    storeMember: { count: mocks.count, findMany: mocks.members, findFirst: mocks.member, update: mocks.updateMember } };
  return { prisma: { ...tx, $transaction: async (callback: (value: unknown) => unknown) => callback(tx) } };
});

import { GET, POST } from "../app/api/admin/users/route";
import { PATCH } from "../app/api/admin/users/[userId]/route";
import { POST as upload } from "../app/api/uploads/route";
import { PATCH as settings } from "../app/api/admin/commerce-settings/route";
import { PATCH as draft, POST as publish } from "../app/api/admin/design-draft/route";
import { PATCH as legacySettings } from "../app/api/admin/store/route";

const publicUser = { id: "member", name: "María", email: "maria@example.test", status: "ACTIVE", createdAt: new Date("2026-10-02T12:00:00Z") };
const context = { user: { id: "actor" }, store: { id: "store-a", ownerId: "owner" }, role: "OWNER" };
const request = (body: unknown) => new Request("http://localhost/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const patch = (body: unknown, id = "member") => PATCH(request(body), { params: Promise.resolve({ userId: id }) });
const newUser = { name: "María", email: "maria@example.test", password: "password123", role: "OPERATOR" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(context.user); mocks.context.mockResolvedValue(context);
  mocks.create.mockResolvedValue(publicUser); mocks.update.mockResolvedValue(publicUser);
  mocks.hash.mockResolvedValue("hashed-password"); mocks.owner.mockResolvedValue({ ...publicUser, id: "owner" });
  mocks.count.mockResolvedValue(1); mocks.members.mockResolvedValue([{ userId: "member", role: "OPERATOR", user: publicUser }]);
  mocks.member.mockResolvedValue({ userId: "member", role: "OPERATOR", user: { email: publicUser.email } });
  mocks.presign.mockResolvedValue("http://storage.test/upload");
});

describe("usuarios y aislamiento de tiendas", () => {
  it("crea cuenta y membresía juntas con contraseña hasheada y email normalizado", async () => {
    const response = await POST(request({ ...newUser, email: "  MARIA@EXAMPLE.TEST " }));
    expect(response.status).toBe(201);
    expect(mocks.hash).toHaveBeenCalledWith("password123", 10);
    expect(mocks.create.mock.calls[0][0]).toMatchObject({ data: { email: "maria@example.test", role: "MERCHANT", status: "ACTIVE", passwordHash: "hashed-password", membership: { create: { storeId: "store-a", role: "OPERATOR" } } } });
    expect(await response.json()).toEqual({ user: { ...publicUser, role: "OPERATOR", createdAt: publicUser.createdAt.toISOString() } });
    expect(mocks.create.mock.calls[0][0].select).not.toHaveProperty("passwordHash");
  });
  it("permite que administradores creen otros administradores", async () => {
    mocks.context.mockResolvedValue({ ...context, role: "ADMIN" });
    expect((await POST(request({ ...newUser, role: "ADMIN" }))).status).toBe(201);
  });
  it("rechaza emails en uso sin asociar cuentas existentes", async () => {
    mocks.create.mockRejectedValueOnce({ code: "P2002" });
    expect((await POST(request(newUser))).status).toBe(409);
    expect(mocks.updateMember).not.toHaveBeenCalled();
  });
  it.each([{ ...newUser, password: "short" }, { ...newUser, password: "é".repeat(40) }, { ...newUser, role: "SUPER_ADMIN" }, { ...newUser, storeId: "store-b" }])("rechaza credenciales o campos no permitidos", async body => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("filtra y pagina dentro de la tienda de la sesión", async () => {
    mocks.count.mockResolvedValue(12);
    const response = await GET(new Request("http://localhost/api/admin/users?q=MAR&role=OPERATOR&status=ACTIVE&page=99&pageSize=10"));
    expect(response.status).toBe(200);
    expect(mocks.members.mock.calls[0][0]).toMatchObject({ where: { storeId: "store-a", role: "OPERATOR", user: { status: "ACTIVE" } }, skip: 10, take: 10 });
    expect(await response.json()).toMatchObject({ page: 2, total: 12, users: [{ canEdit: true }] });
  });
  it("no expone acciones para la propia cuenta", async () => {
    mocks.members.mockResolvedValue([{ userId: "actor", role: "ADMIN", user: { ...publicUser, id: "actor" } }]);
    const response = await GET(new Request("http://localhost/api/admin/users"));
    expect(await response.json()).toMatchObject({ users: [{ canEdit: false }] });
  });
  it.each(["owner", "actor"])("protege titular y propia cuenta: %s", async id => {
    expect((await patch({ status: "SUSPENDED" }, id)).status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rechaza miembros ajenos sin actualizar cuentas", async () => {
    mocks.member.mockResolvedValue(null);
    expect((await patch({ name: "Otro" }, "foreign-member")).status).toBe(404);
    expect(mocks.member).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "foreign-member", storeId: "store-a" } }));
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("actualiza el rol y conserva contraseña cuando está vacía", async () => {
    expect((await patch({ role: "ADMIN", password: "" })).status).toBe(200);
    expect(mocks.updateMember).toHaveBeenCalledWith({ where: { userId: "member" }, data: { role: "ADMIN" } });
    expect(mocks.hash).not.toHaveBeenCalled();
    expect(mocks.update.mock.calls[0][0].data).not.toHaveProperty("passwordHash");
  });
  it.each([{ status: "SUSPENDED" }, { password: "replacement123" }, { email: "another@example.test" }])("revoca sesiones al suspender o cambiar credenciales", async body => {
    expect((await patch(body)).status).toBe(200);
    expect(mocks.update.mock.calls[0][0].data.authVersion).toEqual({ increment: 1 });
  });
  it("reactiva sin recuperar versiones de sesiones revocadas", async () => {
    expect((await patch({ status: "ACTIVE" })).status).toBe(200);
    expect(mocks.update.mock.calls[0][0].data).not.toHaveProperty("authVersion");
  });
  it.each([{}, { role: "OWNER" }, { authVersion: 0 }, { storeId: "store-b" }])("rechaza cambios no permitidos", async body => {
    expect((await patch(body)).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe("permisos en APIs", () => {
  it("devuelve 401 sin sesión y 403 con una tienda inaccesible", async () => {
    mocks.auth.mockResolvedValueOnce(null);
    expect((await POST(request(newUser))).status).toBe(401);
    mocks.context.mockResolvedValueOnce(null);
    expect((await POST(request(newUser))).status).toBe(403);
  });
  it("bloquea usuarios, configuración y publicación para operadores", async () => {
    mocks.context.mockResolvedValue({ ...context, role: "OPERATOR" });
    for (const handler of [POST, settings, draft, publish, legacySettings]) expect((await handler(request(newUser))).status).toBe(403);
    expect((await GET(new Request("http://localhost/api/admin/users"))).status).toBe(403);
    expect((await patch({ role: "ADMIN" })).status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each(["products", "categories"])("operadores pueden subir %s", async scope => {
    mocks.context.mockResolvedValue({ ...context, role: "OPERATOR" });
    expect((await upload(request({ scope, contentType: "image/webp", size: 100 }))).status).toBe(200);
  });
  it.each(["logos", "hero"])("operadores no pueden subir %s", async scope => {
    mocks.context.mockResolvedValue({ ...context, role: "OPERATOR" });
    expect((await upload(request({ uploads: [{ scope: "products", contentType: "image/webp", size: 100 }, { scope, contentType: "image/webp", size: 100 }] }))).status).toBe(403);
    expect(mocks.presign).not.toHaveBeenCalled();
  });
});
