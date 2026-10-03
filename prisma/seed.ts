import "../prisma.config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { seedDemos } from "./demo-seed";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

seedDemos(prisma)
  .then(summaries => {
    for (const demo of summaries) console.log(`✅ ${demo.name} /${demo.slug}: ${demo.products} productos, ${demo.categories} categorías, ${demo.customers} clientes, ${demo.orders} pedidos. Administrador: ${demo.email}`);
    console.log("Demos reconstruidas. Se reemplazaron sus datos anteriores y se restablecieron sus contraseñas; las demás tiendas se conservaron.");
  })
  .catch(error => { console.error("❌ Error reconstruyendo las demos:", error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
