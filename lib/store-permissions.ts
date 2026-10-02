export type StoreRole = "OWNER" | "ADMIN" | "OPERATOR";
export type StorePermission = "operate" | "settings" | "users";

export function hasStorePermission(role: StoreRole, permission: StorePermission) {
  return permission === "operate" || role === "OWNER" || role === "ADMIN";
}

export function canManageStoreUser(actorId: string, ownerId: string, targetId: string) {
  return targetId !== ownerId && targetId !== actorId;
}
