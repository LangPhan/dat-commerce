import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminLayoutShell } from "@/features/admin/admin-context";
import "../editor.css";

export const metadata: Metadata = {
  title: {
    default: "Admin",
    template: "%s · Admin · Dat Commerce",
  },
  description:
    "Merchant workspace for managing products, orders, pages, themes, and AI tools.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminLayoutShell>{children}</AdminLayoutShell>;
}
