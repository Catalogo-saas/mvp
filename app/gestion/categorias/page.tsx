import { CategoryManager } from "@/components/category-manager";
import { getMerchantStore } from "@/lib/merchant";
import { getAdminCategories } from "@/lib/admin-categories";

export default async function CategoriesPage() {
  const store = await getMerchantStore();
  if (!store) return null;
  return <CategoryManager initialCategories={await getAdminCategories(store.id)} />;
}
