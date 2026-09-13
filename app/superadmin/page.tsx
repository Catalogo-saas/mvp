import { SuperAdminTenantManager } from "@/components/super-admin-tenant-manager";
import { getTenantSummaries } from "@/lib/tenant-admin";

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  return <SuperAdminTenantManager initialTenants={await getTenantSummaries()} />;
}
