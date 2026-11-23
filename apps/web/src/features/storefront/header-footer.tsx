"use client";
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
import { initialStoreMenu } from "@/mocks/pages";
import { usd } from "@/lib/format";
import { useStored } from "@/lib/storage";
import type { StoreMenuLink } from "@/types/commerce";

export function StoreHeader({
  preview = false,
  cart = 0,
  wishlistCount = 0,
  currentPath = "/store",
}: {
  preview?: boolean;
  cart?: number;
  wishlistCount?: number;
  currentPath?: string;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [links] = useStored<StoreMenuLink[]>("store-menu", initialStoreMenu);
  const [shipping] = useStored<Record<string, string>>("preferences:shipping", {});
  const [storeInfo] = useStored<Record<string, string>>("preferences:store-information", {});

  const thresholdNum = Number(shipping["Free shipping threshold"] || "100");
  const freeShippingThreshold = usd(Number.isFinite(thresholdNum) ? thresholdNum : 100);
  const storeName = (storeInfo["Store name"] || "TERRAIN").toUpperCase();

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
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X size={19} /> : <Menu size={19} />}
        </button>

        <Link
          href="/store"
          className="terrain-logo"
          tabIndex={preview ? -1 : 0}
        >
          <Mountain size={22} strokeWidth={2.3} />
          <span>{storeName}</span>
        </Link>

        <nav
          className={menuOpen ? "store-nav open" : "store-nav"}
          aria-label="Store navigation"
        >
          {links.map((item) => (
            <Link
              key={item.id}
              href={item.url}
              tabIndex={preview ? -1 : 0}
              aria-current={currentPath === item.url ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="store-icons">
          {preview ? (
            <Link href="/store/search" aria-label="Search" tabIndex={-1}>
              <Search size={17} />
            </Link>
          ) : (
            <button
              type="button"
              aria-label="Toggle search bar"
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((v) => !v)}
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

export function StoreFooter() {
  const [storeInfo] = useStored<Record<string, string>>("preferences:store-information", {});
  const storeName = (storeInfo["Store name"] || "TERRAIN").toUpperCase();

  return (
    <footer className="store-footer">
      <div className="store-footer-col">
        <Link href="/store" className="terrain-logo">
          <Mountain size={22} />
          <span>{storeName}</span>
        </Link>
        <p style={{ color: "#c2cfc5", fontSize: "12.5px", maxWidth: "30ch", marginTop: "6px" }}>
          Multi-category technical essentials and precision studio hardware, unified on Forma Commerce.
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
        <span>© {new Date().getFullYear()} {storeInfo["Store name"] || "Terrain Supply"}. Powered by Forma Commerce.</span>
        <span>{storeInfo["Contact email"] || "hello@terrain.example"}</span>
      </div>
    </footer>
  );
}
