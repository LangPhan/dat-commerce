import { Skeleton } from "@/components/ui/data-display";

export default function StorefrontLoading() {
  return (
    <div className="store-container" aria-busy="true" aria-label="Loading page">
      <Skeleton rows={5} />
    </div>
  );
}
