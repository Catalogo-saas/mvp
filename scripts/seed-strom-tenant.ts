import "../prisma.config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { seedStrom } from "../prisma/strom-seed";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
seedStrom(prisma).then(result => {
  console.log(`${result.created ? "Creado" : "Verificado"}: /${result.slug}, ${result.products} productos. Administrador: ${result.email}`);
  if (result.password) console.log(`Contraseña generada (guardala; no se restablece al repetir): ${result.password}`);
  else console.log("Credenciales y datos existentes conservados.");
}).catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
