import { Storefront } from "@/features/storefront/storefront";
export default async function StorePage({params}: {params:Promise<{route?:string[]}>}) {
  return <Storefront route={(await params).route||[]}/>;
}
