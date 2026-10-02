import { StoreUserManager } from "@/components/store-user-manager";
import { requireMerchantPage } from "@/lib/merchant-authorization";
import { listStoreUsers } from "@/lib/store-team";
import "./users.css";

type Filters = { q?: string; role?: string; status?: string; page?: string; pageSize?: string };
export default async function UsersPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const context = await requireMerchantPage("users");
  const filters = await searchParams;
  const params = new URLSearchParams();
  for (const key of ["q", "role", "status", "page", "pageSize"] as const) {
    if (typeof filters[key] === "string") params.set(key, filters[key]);
  }
  return <StoreUserManager initialData={await listStoreUsers(context, params)} initialFilters={filters} />;
}
