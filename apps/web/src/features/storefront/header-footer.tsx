"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Heart,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Mountain,
  Palette,
  Search,
  ShoppingBag,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { useState, type CSSProperties } from "react";
import { IconButton } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { StoreImage } from "@/components/ui/store-image";
import { isAdminUser, useOptionalAuth } from "@/features/auth/auth-context";
import { cmsStoreApi } from "@/lib/cms-ai-api";
import { usd } from "@/lib/format";
import { initialStoreMenu } from "@/mocks/pages";
import type {
  NavigationItemDto,
  ThemeFooterConfig,
  ThemeHeaderConfig,
} from "@/types/api-cms-ai";
import {
  formatAnnouncementText,
  formatCopyrightText,
  normalizeFooterConfig,
  normalizeHeaderConfig,
} from "./chrome-defaults";

const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  x: "X",
  youtube: "YouTube",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
};

function isExternalHref(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function StoreHeader({
  preview = false,
  cart = 0,
  wishlistCount = 0,
  currentPath = "/",
  storeNameOverride,
  freeShippingThresholdOverride,
  headerConfig,
  initialNavItems,
}: {
  preview?: boolean;
  cart?: number;
  wishlistCount?: number;
  currentPath?: string;
  storeNameOverride?: string;
  freeShippingThresholdOverride?: number;
  headerConfig?: ThemeHeaderConfig | null;
  initialNavItems?: NavigationItemDto[];
}) {
  const router = useRouter();
  const auth = useOptionalAuth();
  const user = auth?.user ?? null;
  const isAdmin = isAdminUser(user);

  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);

  const navQuery = useQuery({
    queryKey: ["store-nav", "main"],
    queryFn: () => cmsStoreApi.getNavigation("main"),
    enabled: !preview,
    initialData: initialNavItems
      ? {
          id: "ssr-main",
          menuKey: "main",
          items: initialNavItems,
          updatedAt: "",
        }
      : undefined,
    staleTime: 60_000,
  });

  const cfg = normalizeHeaderConfig(headerConfig);
  const links = navQuery.data?.items?.length
    ? navQuery.data.items
    : initialNavItems?.length
      ? initialNavItems
      : initialStoreMenu;
  const threshold =
    freeShippingThresholdOverride && Number.isFinite(freeShippingThresholdOverride)
      ? freeShippingThresholdOverride
      : 100;
  const freeShippingThreshold = usd(threshold);
  const announcementText = formatAnnouncementText(
    cfg.announcement.text,
    freeShippingThreshold
  );
  const storeName = (storeNameOverride || cfg.logo.text || "TERRAIN").toUpperCase();

  const announcementStyle = {
    "--store-ann-bg": cfg.announcement.bgColor,
    "--store-ann-fg": cfg.announcement.textColor,
  } as CSSProperties;

  const headerStyle = {
    "--store-header-h": `${cfg.layout.heightPx}px`,
    "--store-header-bg": cfg.layout.bgColor,
    "--store-header-fg": cfg.layout.textColor,
    "--store-header-border": cfg.layout.borderColor,
  } as CSSProperties;

  const announcementInner = (
    <>
      <span>{announcementText}</span>
      <ArrowRight size={12} aria-hidden="true" />
    </>
  );

  return (
    <>
      {cfg.announcement.enabled && announcementText ? (
        <div className="store-announcement" style={announcementStyle}>
          {cfg.announcement.linkUrl && !preview ? (
            <Link href={cfg.announcement.linkUrl} className="store-announcement-link">
              {announcementInner}
            </Link>
          ) : (
            announcementInner
          )}
        </div>
      ) : null}

      <header
        className={`store-header${cfg.layout.sticky && !preview ? " is-sticky" : ""}`}
        style={headerStyle}
      >
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

        <Link href="/" className="terrain-logo" tabIndex={preview ? -1 : 0}>
          {cfg.logo.imageUrl ? (
            <StoreImage
              src={cfg.logo.imageUrl}
              alt={storeName}
              width={Math.round(cfg.logo.heightPx * 4)}
              height={cfg.logo.heightPx}
              style={{ height: `${cfg.logo.heightPx}px`, width: "auto" }}
              className="store-logo-img"
            />
          ) : (
            <>
              {cfg.logo.showIcon ? <Mountain size={20} strokeWidth={2.2} /> : null}
              <span>{storeName}</span>
            </>
          )}
        </Link>

        <nav
          className={menuOpen ? "store-nav open" : "store-nav"}
          aria-label="Store navigation"
        >
          {links.map((link) => {
            const href = link.url === "/store" ? "/" : link.url;
            const isHome = href === "/";
            const active = isHome
              ? currentPath === "/" || currentPath === "/store"
              : currentPath === href || currentPath.startsWith(`${href}/`);
            return (
              <Link
                key={link.id}
                href={href}
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
          {cfg.actions.showSearch ? (
            preview ? (
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
            )
          ) : null}

          {cfg.actions.showWishlist ? (
            <Link
              href="/store/wishlist"
              aria-label={`Wishlist (${wishlistCount})`}
              tabIndex={preview ? -1 : 0}
            >
              <Heart size={17} />
              {wishlistCount > 0 ? <small>{wishlistCount}</small> : null}
            </Link>
          ) : null}

          {cfg.actions.showAccount ? (
            preview ? (
              <Link href="/store/account" aria-label="Account" tabIndex={-1}>
                <UserRound size={17} />
              </Link>
            ) : (
              <Popover open={accountOpen} onOpenChange={setAccountOpen}>
                <PopoverTrigger
                  type="button"
                  aria-label={user ? `Account (${user.fullName})` : "Account"}
                  title={user ? `${user.fullName} (${user.email})` : "Sign in or manage account"}
                  className={user ? "store-account-trigger is-signed-in" : "store-account-trigger"}
                >
                  <UserRound size={17} />
                  {user ? <span className="store-account-dot" aria-hidden="true" /> : null}
                </PopoverTrigger>
                <PopoverContent align="end" className="store-account-popover">
                  <PopoverHeader>
                    <PopoverTitle>
                      {user ? user.fullName : "Customer Account"}
                    </PopoverTitle>
                    <PopoverDescription>
                      {user
                        ? `${user.email} · ${user.roles.join(", ")}`
                        : "Sign in to unlock Shopping AI and saved orders."}
                    </PopoverDescription>
                  </PopoverHeader>
                  <div className="store-account-menu">
                    {user ? (
                      <>
                        <Link
                          href="/store/account"
                          className="store-account-item"
                          onClick={() => setAccountOpen(false)}
                        >
                          <UserRound size={14} />
                          <span>Account Profile</span>
                        </Link>
                        <Link
                          href="/store/history"
                          className="store-account-item"
                          onClick={() => setAccountOpen(false)}
                        >
                          <ShoppingBag size={14} />
                          <span>Order History</span>
                        </Link>
                        {isAdmin ? (
                          <>
                            <Link
                              href="/admin"
                              className="store-account-item"
                              onClick={() => setAccountOpen(false)}
                            >
                              <LayoutDashboard size={14} />
                              <span>Merchant Admin</span>
                            </Link>
                            <Link
                              href="/admin/editor"
                              className="store-account-item"
                              onClick={() => setAccountOpen(false)}
                            >
                              <Palette size={14} />
                              <span>Theme Editor</span>
                            </Link>
                          </>
                        ) : null}
                        <button
                          type="button"
                          className="store-account-item is-danger"
                          onClick={async () => {
                            setAccountOpen(false);
                            await auth?.logout();
                            router.refresh();
                          }}
                        >
                          <LogOut size={14} />
                          <span>Sign Out</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          href={`/login?next=${encodeURIComponent(currentPath || "/")}`}
                          className="store-account-item is-primary"
                          onClick={() => setAccountOpen(false)}
                        >
                          <LogIn size={14} />
                          <span>Sign In</span>
                        </Link>
                        <Link
                          href={`/login?mode=register&next=${encodeURIComponent(currentPath || "/")}`}
                          className="store-account-item"
                          onClick={() => setAccountOpen(false)}
                        >
                          <UserPlus size={14} />
                          <span>Create Free Account</span>
                        </Link>
                        <Link
                          href="/store/history"
                          className="store-account-item"
                          onClick={() => setAccountOpen(false)}
                        >
                          <ShoppingBag size={14} />
                          <span>Guest Order History</span>
                        </Link>
                      </>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )
          ) : null}

          {cfg.actions.showCart ? (
            <Link
              href="/store/cart"
              aria-label={`Cart (${cart})`}
              tabIndex={preview ? -1 : 0}
            >
              <ShoppingBag size={17} />
              {cart > 0 ? <small>{cart}</small> : null}
            </Link>
          ) : null}
        </div>
      </header>

      {searchOpen && !preview && cfg.actions.showSearch ? (
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

export function StoreFooter({
  storeName,
  footerConfig,
  preview = false,
  onNotify,
}: {
  storeName?: string;
  footerConfig?: ThemeFooterConfig | null;
  preview?: boolean;
  onNotify?: (msg: string) => void;
}) {
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const cfg = normalizeFooterConfig(footerConfig);
  const brandName = storeName || cfg.brand.name || "Terrain Supply";
  const colCount = Math.max(1, cfg.columns.length);

  const footerStyle = {
    "--store-footer-bg": cfg.style.bgColor,
    "--store-footer-fg": cfg.style.textColor,
    "--store-footer-muted": cfg.style.mutedColor,
    "--store-footer-border": cfg.style.borderColor,
    "--footer-cols": String(colCount),
  } as CSSProperties;

  return (
    <footer className="store-footer" style={footerStyle}>
      <div className="store-footer-col store-footer-brand">
        <Link href="/" className="terrain-logo" tabIndex={preview ? -1 : 0}>
          {cfg.brand.logoImageUrl ? (
            <StoreImage
              src={cfg.brand.logoImageUrl}
              alt={brandName}
              width={120}
              height={28}
              style={{ height: "28px", width: "auto" }}
            />
          ) : (
            <>
              {cfg.brand.showIcon ? <Mountain size={22} /> : null}
              <span>{brandName.toUpperCase()}</span>
            </>
          )}
        </Link>
        {cfg.brand.description ? (
          <p className="store-footer-desc">{cfg.brand.description}</p>
        ) : null}

        {cfg.newsletter.enabled ? (
          <form
            className="store-footer-newsletter"
            onSubmit={(e) => {
              e.preventDefault();
              if (preview) return;
              if (!newsletterEmail.trim()) return;
              setNewsletterEmail("");
              onNotify?.("Subscribed to store updates");
            }}
          >
            {cfg.newsletter.title ? (
              <span className="store-footer-nl-title">{cfg.newsletter.title}</span>
            ) : null}
            <div className="store-footer-nl-row">
              <input
                type="email"
                required
                disabled={preview}
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder={cfg.newsletter.placeholder || "you@example.com"}
                aria-label="Newsletter email"
              />
              <button type="submit" disabled={preview}>
                {cfg.newsletter.buttonLabel || "Subscribe"}
              </button>
            </div>
          </form>
        ) : null}

        {cfg.socialLinks.length > 0 ? (
          <div className="store-footer-socials">
            {cfg.socialLinks.map((social) => {
              const label = SOCIAL_LABELS[social.platform] || social.platform;
              return isExternalHref(social.url) ? (
                <a
                  key={social.id}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  tabIndex={preview ? -1 : 0}
                >
                  {label}
                </a>
              ) : (
                <Link key={social.id} href={social.url} tabIndex={preview ? -1 : 0}>
                  {label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>

      {cfg.columns.map((col) => (
        <div className="store-footer-col" key={col.id}>
          <h3>{col.title}</h3>
          {col.links.map((link) =>
            isExternalHref(link.url) ? (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                tabIndex={preview ? -1 : 0}
              >
                {link.label}
              </a>
            ) : (
              <Link key={link.id} href={link.url} tabIndex={preview ? -1 : 0}>
                {link.label}
              </Link>
            )
          )}
        </div>
      ))}

      <div className="store-footer-bottom">
        <span>{formatCopyrightText(cfg.bottomBar.copyrightText, brandName)}</span>
        {cfg.bottomBar.contactEmail ? <span>{cfg.bottomBar.contactEmail}</span> : null}
      </div>
    </footer>
  );
}
