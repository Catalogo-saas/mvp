import { redirect } from "next/navigation";

import { getSuperAdminUser } from "@/lib/merchant";
import { InternalToaster } from "@/components/internal-toaster";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await getSuperAdminUser())) {
    redirect("/panel");
  }
  return <>
    <InternalToaster />
    {children}
  </>;
}
