import Link from "next/link";

export default function StoreNotFoundPage() {
  return (
    <div className="store-container">
      <h1>Page not found</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        The storefront page, product, or collection you requested does not exist or has moved.
      </p>
      <div className="button-row">
        <Link className="btn primary" href="/">
          Return home
        </Link>
        <Link className="btn" href="/store/shop">
          Browse catalog
        </Link>
      </div>
    </div>
  );
}
