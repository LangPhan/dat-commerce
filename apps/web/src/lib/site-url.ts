const DEFAULT_SITE_URL = "http://localhost:3000";
const DEFAULT_API_INTERNAL_URL = "http://localhost:8080";

export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    DEFAULT_SITE_URL;
  return raw.replace(/\/+$/, "");
}

export function getMetadataBase(): URL {
  try {
    return new URL(getSiteUrl());
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
}

export function getApiInternalUrl(): string {
  const raw = process.env.API_INTERNAL_URL || DEFAULT_API_INTERNAL_URL;
  return raw.replace(/\/+$/, "");
}
