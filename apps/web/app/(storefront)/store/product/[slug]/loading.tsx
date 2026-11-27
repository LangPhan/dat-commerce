import { Skeleton } from "@/components/ui/data-display";

export default function ProductDetailLoading() {
  return (
    <div className="store-container" aria-busy="true" aria-label="Loading product">
      <div className="product-detail">
        <Skeleton rows={6} />
        <Skeleton rows={6} />
      </div>
    </div>
  );
}
