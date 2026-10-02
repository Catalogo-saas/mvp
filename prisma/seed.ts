import "../prisma.config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { defaultCheckoutSettings, defaultDeliveryMethods, defaultMenuConfig } from "../lib/commerce-settings";
import { defaultDesignConfig } from "../lib/design-config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { defaultPublicPageConfig } from "../lib/public-page-config";
import { variantCombinations } from "../lib/product-variants";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const existingUser = await prisma.user.findUnique({
    where: { email: "demo@landing.test" },
    include: { store: true }
  });
  const existingStore = await prisma.store.findUnique({
    where: { slug: "demo" },
    include: { owner: true }
  });
  if (existingUser?.store && existingUser.store.slug !== "demo") {
    throw new Error("El email demo ya pertenece a otra tienda.");
  }
  if (existingUser && (existingUser.role !== "MERCHANT" || existingUser.status !== "ACTIVE")) {
    throw new Error("La cuenta demo existente debe ser un comerciante activo.");
  }
  if (existingStore && existingStore.owner.email !== "demo@landing.test") {
    throw new Error("La URL /demo ya pertenece a otro comerciante.");
  }

  const passwordHash = await bcrypt.hash("demo1234", 10);
  const result = await prisma.$transaction(async (transaction) => {
    const user = await transaction.user.upsert({
      where: { email: "demo@landing.test" },
      update: {},
      create: {
        email: "demo@landing.test",
        name: "Demo Merchant",
        passwordHash,
        role: "MERCHANT",
        status: "ACTIVE"
      }
    });

    const store = await transaction.store.upsert({
      where: { slug: "demo" },
      update: {},
      create: {
        ownerId: user.id,
        name: "Norte Demo",
        slug: "demo",
        description: "Indumentaria y accesorios para todos los días.",
        whatsappPhone: "541123456789",
        businessType: "RETAIL",
        template: "roma",
        theme: { primary: "#242624", accent: "#c8b69a", useTemplateColors: true, font: "Inter" },
        designConfig: defaultDesignConfig,
        publicPageConfig: defaultPublicPageConfig,
        menuConfig: defaultMenuConfig,
        checkoutSettings: defaultCheckoutSettings,
        deliveryMethods: defaultDeliveryMethods,
        acceptCashPayments: true,
        acceptTransferPayments: false,
        whatsappOrdersEnabled: false,
        heroTitle: "Vestí tu estilo",
        heroSubtitle: "Descubrí nuestra nueva colección."
      }
    });

    const categories = [];
    for (const [index, definition] of [{name:"Mujer",slug:"mujer"},{name:"Hombre",slug:"hombre"},{name:"Calzado",slug:"calzado"}].entries()) {
      categories.push(await transaction.category.upsert({ where:{storeId_slug:{storeId:store.id,slug:definition.slug}},update:{},create:{storeId:store.id,...definition,sortOrder:index} }));
    }
    const childDefinitions=[{name:"Camisas",slug:"mujer-camisas",parentId:categories[0].id},{name:"Remeras",slug:"hombre-remeras",parentId:categories[1].id},{name:"Zapatillas",slug:"calzado-zapatillas",parentId:categories[2].id}];
    const children=[];
    for(const definition of childDefinitions)children.push(await transaction.category.upsert({where:{storeId_slug:{storeId:store.id,slug:definition.slug}},update:{parentId:definition.parentId},create:{storeId:store.id,...definition}}));
    const linen=await transaction.category.upsert({where:{storeId_slug:{storeId:store.id,slug:"mujer-camisas-lino"}},update:{parentId:children[0].id},create:{storeId:store.id,name:"Lino",slug:"mujer-camisas-lino",parentId:children[0].id}});
    const definitions = [
      {name:"Camisa de lino",slug:"camisa-lino",category:linen,price:49000,image:"https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=1200&q=85",sizes:["S","M","L"],colors:["Crudo","Oliva"]},
      {name:"Remera clásica",slug:"remera-clasica",category:children[1],price:32000,image:"https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=85",sizes:["S","M","L","XL"],colors:["Blanco","Negro"]},
      {name:"Zapatillas urbanas",slug:"zapatillas-urbanas",category:children[2],price:89000,image:"https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=85",sizes:["38","39","40","41"],colors:["Rojo","Negro"]}
    ];
    for (const [index,definition] of definitions.entries()) {
      const groups=[{name:"Talle",selectionType:"SINGLE",options:definition.sizes.map(name=>({name}))},{name:"Color",selectionType:"SINGLE",options:definition.colors.map(name=>({name}))}];
      await transaction.product.upsert({where:{storeId_slug:{storeId:store.id,slug:definition.slug}},update:{categoryId:definition.category.id,assignedCategories:{connect:{id:definition.category.id}}},create:{storeId:store.id,categoryId:definition.category.id,assignedCategories:{connect:{id:definition.category.id}},name:definition.name,slug:definition.slug,description:"Diseño versátil para todos los días.",basePrice:definition.price,imageUrls:[definition.image],isFeatured:true,isVisible:true,stockQuantity:null,sortOrder:index,variants:variantCombinations(groups).map(({key})=>({key,stockQuantity:5,basePrice:definition.price,promoPrice:null})),optionGroups:{create:groups.map((group,groupIndex)=>({name:group.name,selectionType:"SINGLE",isRequired:true,minSelections:1,maxSelections:1,sortOrder:groupIndex,options:{create:group.options.map((option,sortOrder)=>({name:option.name,sortOrder,priceDelta:0}))}}))}}});
    }
    const sections=structuredClone(defaultPublicPageConfig.homeSections);
    sections[0].title="Nueva colección";
    sections[0].images=["https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1600&q=85"];
    sections[2].categoryIds=categories.map(category=>category.id);
    sections[2].categoryImages=Object.fromEntries(categories.map((category,index)=>[category.id,definitions[index].image]));
    await transaction.store.update({where:{id:store.id},data:{publicPageConfig:{...defaultPublicPageConfig,homeSections:sections}}});
    return { store, product: definitions[0] };
  });
  console.log(`Tienda /${result.store.slug} y producto ${result.product.slug} disponibles.`);
}

main()
  .then(() => {
    console.log("✅ Seed aplicado correctamente");
  })
  .catch((error) => {
    console.error("❌ Error aplicando el seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
