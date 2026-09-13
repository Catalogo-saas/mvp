import { redirect } from "next/navigation";

import { getSuperAdminUser } from "@/lib/merchant";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await getSuperAdminUser())) {
    redirect("/panel");
  }
  return <>{children}</>;
}
