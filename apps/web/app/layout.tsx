import type { Metadata } from "next";
import { AppProviders } from "@/lib/query-provider";
import "./globals.css";
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
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
