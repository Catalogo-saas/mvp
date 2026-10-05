import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../lib/generated/prisma/client";
import { seedStrom, stromIdentity } from "../prisma/strom-seed";

function fixture(user: unknown, store: unknown) {
  const tx = {
    $queryRaw: vi.fn(),
    user: { findUnique: vi.fn().mockResolvedValue(user), create: vi.fn() },
    store: { findUnique: vi.fn().mockResolvedValue(store), upsert: vi.fn() }
  };
  const client = { $transaction: async (callback: (transaction: typeof tx) => unknown) => callback(tx) } as unknown as PrismaClient;
  return { client, tx };
}

describe("Strom identity isolation", () => {
  it("aborts if the public URL belongs to a different merchant", async () => {
    const { client, tx } = fixture(null, { owner: { email: "another@example.invalid" } });
    await expect(seedStrom(client)).rejects.toThrow("otro comerciante");
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.store.upsert).not.toHaveBeenCalled();
  });
  it.each([
    { role: "SUPER_ADMIN", membership: null, store: null },
    { role: "MERCHANT", membership: { storeId: "another" }, store: null },
    { role: "MERCHANT", membership: null, store: { slug: "another" } }
  ])("rejects an incompatible existing owner account: %j", async user => {
    const { client, tx } = fixture({ ...user, email: stromIdentity.email }, null);
    await expect(seedStrom(client)).rejects.toThrow("rol incompatible");
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.store.upsert).not.toHaveBeenCalled();
  });
});
