// Local, disposable fixtures for the product/sales workflow regression checks.
import { prisma } from "../lib/prisma";
import { variantKeyFromNames } from "../lib/product-variants";

const prefix = "qa_commerce_workflow_";
if (!["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL ?? "postgresql://localhost/landing_saas").hostname)) throw Error("Solo se permite la base local.");
const store = await prisma.store.findUniqueOrThrow({ where: { slug: "demo" } });
if (process.argv[2] === "cleanup") {
  const removed = await prisma.$transaction([
    prisma.order.deleteMany({ where: { storeId: store.id, id: { startsWith: prefix } } }),
    prisma.product.deleteMany({ where: { storeId: store.id, id: { startsWith: prefix } } }),
    prisma.category.deleteMany({ where: { storeId: store.id, id: { startsWith: prefix } } })
  ]);
  console.log("Fixtures QA eliminados:", removed.map(result => result.count));
} else if (process.argv[2] === "inspect") {
  console.log(JSON.stringify({
    orders: await prisma.order.findMany({ where: { id: { startsWith: prefix } }, select: { id: true, readAt: true, updatedAt: true, status: true, stockReserved: true, _count: { select: { events: true } } } }),
    products: await prisma.product.findMany({ where: { id: { startsWith: prefix } }, select: { id: true, imageUrls: true, isVisible: true, variants: true, categoryId: true, assignedCategories: { select: { id: true } }, optionGroups: { select: { name: true, options: { orderBy: { sortOrder: "asc" }, select: { name: true } } } } } })
  }, null, 2));
} else {
  for (const [id, name, parent] of [["root", "QA Indumentaria", null], ["child", "QA Mujer", "root"], ["leaf", "QA Camisas", "child"], ["other", "QA Accesorios", null]] as const) {
    await prisma.category.upsert({ where: { id: prefix + id }, update: {}, create: { id: prefix + id, storeId: store.id, name, slug: prefix + id, parentId: parent ? prefix + parent : null } });
  }
  const imageUrls = ["baby-mini", "baby-bosque", "baby-atelier", "premium-minimal"].map(name => `http://localhost:3000/template-previews/${name}.jpg`);
  await prisma.product.upsert({ where: { id: prefix + "product" }, update: {}, create: {
    id: prefix + "product", storeId: store.id, slug: prefix + "product", name: "QA Camisa de prueba", sku: "QA-COMMERCE", basePrice: 12000, stockQuantity: null, isVisible: false, imageUrls,
    categoryId: prefix + "leaf", assignedCategories: { connect: [{ id: prefix + "leaf" }] },
    variants: ["S", "M"].map(size => ({ key: variantKeyFromNames([{ groupName: "Talle", optionName: size }]), stockQuantity: 4, basePrice: 12000, promoPrice: null, isVisible: true, imageUrl: imageUrls[1] })),
    optionGroups: { create: { name: "Talle", isRequired: true, selectionType: "SINGLE", minSelections: 1, maxSelections: 1, options: { create: ["S", "M"].map((name, sortOrder) => ({ name, sortOrder })) } } }
  } });
  for (const [index, sale] of ["open", "archived", "cancelled"].entries()) {
    await prisma.order.upsert({ where: { id: prefix + sale }, update: {}, create: {
      id: prefix + sale, storeId: store.id, code: "QA-COMMERCE-" + index, customerName: "Cliente de prueba " + (index + 1), customerPhone: "", customerEmail: "qa@example.test", source: "BACKOFFICE", fulfillment: "Envío a domicilio", total: 24000,
      status: sale === "cancelled" ? "CANCELLED" : "PENDING_WHATSAPP", paymentStatus: sale === "cancelled" ? "CANCELLED" : "PENDING", fulfillmentStatus: sale === "cancelled" ? "CANCELLED" : "PENDING", archivedAt: sale === "archived" ? new Date() : null,
      checkout: { paymentMethod: "transfer", deliveryAddress: "Calle de prueba 123", postalCode: "1000", province: "Buenos Aires", city: "Ciudad de prueba", country: "Argentina", dni: "Documento QA", billingAddress: "Calle de facturación 456", shipping: 0, productSubtotal: 24000 }, notes: "Nota de prueba del cliente.",
      items: { create: { productName: "QA Camisa de prueba", quantity: 2, unitPrice: 12000, subtotal: 24000, imageUrl: imageUrls[0], options: [{ groupName: "Talle", optionName: "S" }] } }
    } });
  }
  console.log("QA: 1 producto, 4 categorías y 3 ventas creados.");
}
await prisma.$disconnect();
