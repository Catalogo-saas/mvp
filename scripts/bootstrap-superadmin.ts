import "../prisma.config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../lib/generated/prisma/client";

const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase() ?? "";
const password = process.env.SUPERADMIN_PASSWORD ?? "";
const name = process.env.SUPERADMIN_NAME?.trim() || "Administrador";

if (!email || !password || password.length < 8) {
  throw new Error("Configurá SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD (mínimo 8 caracteres).");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
});

async function main() {
  const existing = await prisma.user.findUnique({ where: { email }, include: { store: true } });
  if (existing?.store) {
    throw new Error("Ese email ya pertenece a un tenant y no puede convertirse en superadmin.");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { name, passwordHash, role: "SUPER_ADMIN", status: "ACTIVE" } })
    : await prisma.user.create({ data: { name, email, passwordHash, role: "SUPER_ADMIN", status: "ACTIVE" } });
  console.log(`Superadmin listo: ${user.email}`);
}

main().finally(async () => prisma.$disconnect());
