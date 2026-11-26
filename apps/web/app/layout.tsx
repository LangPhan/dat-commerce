import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { AppProviders } from "@/lib/query-provider";
import { getMetadataBase } from "@/lib/site-url";
import "./globals.css";
import "./storefront.css";
import "./admin.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: {
    default: "Dat Commerce",
    template: "%s · Dat Commerce",
  },
  description:
    "AI-native ecommerce platform for designing, merchandising, and operating your store.",
  openGraph: {
    type: "website",
    siteName: "Dat Commerce",
    locale: "en_US",
    title: "Dat Commerce",
    description:
      "AI-native ecommerce platform for designing, merchandising, and operating your store.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dat Commerce",
    description:
      "AI-native ecommerce platform for designing, merchandising, and operating your store.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0f13" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var raw=localStorage.getItem("forma:v1:theme")||localStorage.getItem("forma:theme");var t=raw?JSON.parse(raw):"light";if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t;}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
        <Analytics />
      </body>
    </html>
  );
}
