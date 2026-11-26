import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginClient } from "./login-client";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in or create an account to shop or manage Dat Commerce.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="login-page" />}>
      <LoginClient />
    </Suspense>
  );
}
