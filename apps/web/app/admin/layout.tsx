import type { ReactNode } from "react";
import { AdminLayoutShell } from "@/features/admin/admin-context";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminLayoutShell>{children}</AdminLayoutShell>;
}
