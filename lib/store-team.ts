import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { paginationQuery } from "@/lib/admin-list-query";
import { canManageStoreUser } from "@/lib/store-permissions";
import type { getMerchantContext } from "@/lib/merchant";
import type { Prisma } from "@/lib/generated/prisma/client";

export type MerchantContext = NonNullable<Awaited<ReturnType<typeof getMerchantContext>>>;
const email = z.string().trim().toLowerCase().email().max(180);
const password = z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(72)
  .refine(value => Buffer.byteLength(value, "utf8") <= 72, "La contraseña no puede superar 72 bytes.");
export const createStoreUserSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email,
  password,
  role: z.enum(["ADMIN", "OPERATOR"]).default("OPERATOR")
}).strict();
export const updateStoreUserSchema = createStoreUserSchema.omit({ password: true }).extend({
  password: password.or(z.literal("")),
  status: z.enum(["ACTIVE", "SUSPENDED"])
}).partial().strict().refine(value => Object.keys(value).length > 0, "No hay cambios para guardar.");

export const storeUserSelect = { id: true, name: true, email: true, status: true, createdAt: true } as const;
type PublicUser = { id: string; name: string | null; email: string; status: "ACTIVE" | "SUSPENDED"; createdAt: Date };
export function storeUserSummary(user: PublicUser, role: "ADMIN" | "OPERATOR") {
  return { ...user, role, createdAt: user.createdAt.toISOString() };
}
export type StoreUserSummary = ReturnType<typeof storeUserSummary>;

export async function listStoreUsers(context: MerchantContext, params: URLSearchParams) {
  const { page: requestedPage, pageSize } = paginationQuery(params);
  const q = params.get("q")?.trim();
  const role = params.get("role");
  const status = params.get("status");
  const where: Prisma.StoreMemberWhereInput = {
    storeId: context.store.id,
    ...(role === "ADMIN" || role === "OPERATOR" ? { role } : {}),
    user: {
      ...(status === "ACTIVE" || status === "SUSPENDED" ? { status } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] } : {})
    }
  };
  const total = await prisma.storeMember.count({ where });
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize)));
  const [owner, members] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: context.store.ownerId }, select: storeUserSelect }),
    prisma.storeMember.findMany({ where, skip: (page - 1) * pageSize, take: pageSize,
      include: { user: { select: storeUserSelect } }, orderBy: [{ user: { createdAt: "desc" } }, { userId: "asc" }] })
  ]);
  return {
    owner: { ...owner, createdAt: owner.createdAt.toISOString() },
    users: members.map(member => ({ ...storeUserSummary(member.user, member.role),
      canEdit: canManageStoreUser(context.user.id, context.store.ownerId, member.userId) })),
    total, page, pageSize
  };
}
export type StoreUserList = Awaited<ReturnType<typeof listStoreUsers>>;

export function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
