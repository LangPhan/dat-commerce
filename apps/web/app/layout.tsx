import type { Metadata } from "next";
import { AppProviders } from "@/lib/query-provider";
import "./globals.css";
import "./editor.css";
import "./storefront.css";
import "./admin.css";
import "./auth.css";

export const metadata: Metadata = {
  title: {
    default: "Dat Commerce",
    template: "%s · Dat Commerce",
  },
  description:
    "AI-native ecommerce platform for designing, merchandising, and operating your store.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var raw=localStorage.getItem("forma:theme");var t=raw?JSON.parse(raw):"light";if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t;}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
