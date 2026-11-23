"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Heart,
  Menu,
  Mountain,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { IconButton } from "@/components/ui/button";
import { cmsStoreApi } from "@/lib/cms-ai-api";
import { usd } from "@/lib/format";
import { initialStoreMenu } from "@/mocks/pages";

export function StoreHeader({
  preview = false,
  cart = 0,
  wishlistCount = 0,
  currentPath = "/store",
  storeNameOverride,
  freeShippingThresholdOverride,
}: {
  preview?: boolean;
  cart?: number;
  wishlistCount?: number;
  currentPath?: string;
  storeNameOverride?: string;
  freeShippingThresholdOverride?: number;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const navQuery = useQuery({
    queryKey: ["store-nav", "main"],
    queryFn: () => cmsStoreApi.getNavigation("main"),
    enabled: !preview,
  });

  const links = navQuery.data?.items?.length ? navQuery.data.items : initialStoreMenu;
  const threshold =
    freeShippingThresholdOverride && Number.isFinite(freeShippingThresholdOverride)
      ? freeShippingThresholdOverride
      : 100;
  const freeShippingThreshold = usd(threshold);
  const storeName = (storeNameOverride || "TERRAIN").toUpperCase();

  return (
    <>
      <div className="store-announcement">
        <span>Free carbon-neutral shipping on orders over {freeShippingThreshold}</span>
        <ArrowRight size={12} aria-hidden="true" />
      </div>
      <header className="store-header">
        <button
          type="button"
          className="store-menu"
          aria-expanded={menuOpen}
          aria-label="Toggle store navigation"
          disabled={preview}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={19} /> : <Menu size={19} />}
        </button>

        <Link href="/store" className="terrain-logo" tabIndex={preview ? -1 : 0}>
          <Mountain size={20} strokeWidth={2.2} />
          <span>{storeName}</span>
        </Link>

        <nav
          className={menuOpen ? "store-nav open" : "store-nav"}
          aria-label="Store navigation"
        >
          {links.map((link) => {
            const active =
              currentPath === link.url ||
              (link.url !== "/store" && currentPath.startsWith(link.url));
            return (
              <Link
                key={link.id}
                href={link.url}
                className={active ? "active" : ""}
                aria-current={active ? "page" : undefined}
                tabIndex={preview ? -1 : 0}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="store-icons">
          {preview ? (
            <Link href="/store/search" aria-label="Search" tabIndex={-1}>
              <Search size={17} />
            </Link>
          ) : (
            <button
              type="button"
              aria-label="Search catalog"
              onClick={() => setSearchOpen((open) => !open)}
            >
              <Search size={17} />
            </button>
          )}
          <Link
            href="/store/wishlist"
            aria-label={`Wishlist (${wishlistCount})`}
            tabIndex={preview ? -1 : 0}
          >
            <Heart size={17} />
            {wishlistCount > 0 ? <small>{wishlistCount}</small> : null}
          </Link>
          <Link
            href="/store/account"
            aria-label="Account"
            tabIndex={preview ? -1 : 0}
          >
            <UserRound size={17} />
          </Link>
          <Link
            href="/store/cart"
            aria-label={`Cart (${cart})`}
            tabIndex={preview ? -1 : 0}
          >
            <ShoppingBag size={17} />
            {cart > 0 ? <small>{cart}</small> : null}
          </Link>
        </div>
      </header>
      {searchOpen && !preview ? (
        <div className="store-quick-search">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearchOpen(false);
              router.push(`/store/search?q=${encodeURIComponent(searchQuery.trim())}`);
            }}
          >
            <label className="search-field">
              <Search size={15} />
              <input
                autoFocus
                aria-label="Quick search catalog"
                placeholder="Search trail shoes, laptops, phones, apparel…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>
            <button type="submit" className="btn primary">
              Search
            </button>
            <IconButton label="Close search" onClick={() => setSearchOpen(false)}>
              <X size={16} />
            </IconButton>
          </form>
        </div>
      ) : null}
    </>
  );
}

export function StoreFooter({ storeName = "Terrain Supply" }: { storeName?: string }) {
  return (
    <footer className="store-footer">
      <div className="store-footer-col">
        <Link href="/store" className="terrain-logo">
          <Mountain size={22} />
          <span>{storeName.toUpperCase()}</span>
        </Link>
        <p style={{ color: "#c2cfc5", fontSize: "12.5px", maxWidth: "30ch", marginTop: "6px" }}>
          Multi-category technical essentials and precision studio hardware, powered by Dat Commerce.
        </p>
      </div>

      <div className="store-footer-col">
        <h3>Shop</h3>
        <Link href="/store/shop">All products</Link>
        <Link href="/store/categories">Categories</Link>
        <Link href="/store/collections">Collections</Link>
        <Link href="/store/search">Search catalog</Link>
      </div>

      <div className="store-footer-col">
        <h3>Customer</h3>
        <Link href="/store/account">Account</Link>
        <Link href="/store/history">Order history</Link>
        <Link href="/store/wishlist">Wishlist</Link>
        <Link href="/store/cart">Shopping cart</Link>
      </div>

      <div className="store-footer-col">
        <h3>Platform</h3>
        <Link href="/store/about">About us</Link>
        <Link href="/store/contact">Contact support</Link>
        <Link href="/admin">Merchant admin</Link>
        <Link href="/">AI Store Editor</Link>
      </div>

      <div className="store-footer-bottom">
        <span>
          © {new Date().getFullYear()} {storeName}. Powered by Dat Commerce.
        </span>
        <span>hello@datcommerce.local</span>
      </div>
    </footer>
  );
}
