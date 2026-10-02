// Temporary, deterministic fixtures in the local demo store. No existing data is updated.
import { prisma } from "../lib/prisma";
const prefix="qa_admin_redesign_";
const store=await prisma.store.findUnique({where:{slug:"demo"}});
if(!store)throw Error("La tienda demo no existe.");
if(!["localhost","127.0.0.1"].includes(new URL(process.env.DATABASE_URL??"postgresql://localhost/landing_saas").hostname))throw Error("Solo se permiten fixtures sobre una base local.");
if(process.argv[2]==="cleanup"){
 const result=await prisma.$transaction([
 prisma.order.deleteMany({where:{storeId:store.id,id:{startsWith:prefix}}}),
 prisma.product.deleteMany({where:{storeId:store.id,id:{startsWith:prefix}}}),
 prisma.category.deleteMany({where:{storeId:store.id,id:{startsWith:prefix}}})
 ]);
 console.log("Fixtures temporales eliminados:",result.map(r=>r.count));
}else{
 const categories=[["ropa","Ropa QA",null],["mujer","Mujer","ropa"],["hombre","Hombre","ropa"],["pantalones_m","Pantalones","mujer"],["pantalones_h","Pantalones","hombre"],["accesorios","Accesorios QA",null]] as const;
 for(const [id,name,parent] of categories)await prisma.category.upsert({where:{id:prefix+id},update:{},create:{id:prefix+id,storeId:store.id,name,slug:prefix+id,parentId:parent?prefix+parent:null}});
 for(let i=0;i<60;i++){const id=prefix+"product_"+i;await prisma.product.upsert({where:{id},update:{},create:{id,storeId:store.id,name:"QA Producto "+String(i+1).padStart(2,"0"),slug:id,sku:"QA-"+i,basePrice:12500+i*100,promoPrice:i%3===0?10000:null,stockQuantity:i%4===0?0:20,isVisible:i%5!==0,categoryId:prefix+"pantalones_m",assignedCategories:{connect:[{id:prefix+"pantalones_m"}]},...(i===0?{variants:[{key:"Talle:S",basePrice:12500,promoPrice:null,stockQuantity:3},{key:"Talle:M",basePrice:13000,promoPrice:12000,stockQuantity:0}],optionGroups:{create:{name:"Talle",selectionType:"SINGLE",isRequired:true,minSelections:1,maxSelections:1,options:{create:[{name:"S"},{name:"M"}]}}}}:{})}});}
 for(let i=0;i<3;i++){const id=prefix+"order_"+i;await prisma.order.upsert({where:{id},update:{},create:{id,storeId:store.id,code:"QA-REDESIGN-"+i,status:"PENDING_WHATSAPP",paymentStatus:"PENDING",fulfillmentStatus:"PENDING",source:"BACKOFFICE",customerName:"Cliente QA "+i,customerPhone:"541112345678",fulfillment:"Envío personalizado",total:12500,checkout:{paymentMethod:"transfer",shippingAddress:{street:"Calle de prueba",number:"123",city:"Buenos Aires",postalCode:"1000"},billing:{documentNumber:"QA"}},items:{create:{productName:"Producto de prueba QA",quantity:1,unitPrice:12500,subtotal:12500,options:[]}}}});}
 console.log("Fixtures creados: 60 productos, 6 categorías y 3 ventas de prueba.");
}
await prisma.$disconnect();
