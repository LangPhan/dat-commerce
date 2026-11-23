import { Admin } from "@/features/admin/admin";
export default async function AdminPage({params}: {params:Promise<{route?:string[]}>}) {
  return <Admin route={(await params).route||[]}/>;
}
