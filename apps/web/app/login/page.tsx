"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Box, LockKeyhole, ArrowRight } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

const demoAccounts = [
  { label: "Owner", email: "owner@datcommerce.local", pass: "OwnerPass123!" },
  { label: "Catalog Mgr", email: "catalog@datcommerce.local", pass: "CatalogPass123!" },
  { label: "Content Editor", email: "editor@datcommerce.local", pass: "EditorPass123!" },
  { label: "Viewer (Read-only)", email: "viewer@datcommerce.local", pass: "ViewerPass123!" },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, ready, login } = useAuth();
  const [serverError, setServerError] = useState("");

  const rawNext = searchParams.get("next") || "/admin";
  const nextPath = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/admin";

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (ready && user) {
      router.replace(nextPath);
    }
  }, [ready, user, nextPath, router]);

  async function onSubmit(values: LoginValues) {
    setServerError("");
    try {
      await login(values.email, values.password);
      router.replace(nextPath);
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError("Unable to reach authentication service");
      }
    }
  }

  return (
    <div className="login-page">
      <div className="login-card panel">
        <div className="login-brand">
          <span className="forma-mark" style={{ marginLeft: 0 }}>
            <Box size={19} />
          </span>
          <div>
            <strong>Dat Commerce</strong>
            <small className="muted">Merchant &amp; AI Operator Sign In</small>
          </div>
        </div>

        <form className="form-stack" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="ui-field">
            <label className="ui-field-label" htmlFor="login-email">
              Work email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="owner@datcommerce.local"
              {...register("email")}
            />
            {errors.email ? (
              <span className="ui-field-error">{errors.email.message}</span>
            ) : null}
          </div>

          <div className="ui-field">
            <label className="ui-field-label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              {...register("password")}
            />
            {errors.password ? (
              <span className="ui-field-error">{errors.password.message}</span>
            ) : null}
          </div>

          {serverError ? (
            <div className="login-alert" role="alert">
              <LockKeyhole size={15} />
              <span>{serverError}</span>
            </div>
          ) : null}

          <Button variant="primary" size="lg" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in to workspace"}
            <ArrowRight size={15} />
          </Button>
        </form>

        <div className="login-demo-box">
          <span className="muted">Development test accounts:</span>
          <div className="button-row">
            {demoAccounts.map((acc) => (
              <Button
                key={acc.email}
                size="sm"
                variant="secondary"
                onClick={() => {
                  setValue("email", acc.email, { shouldValidate: true });
                  setValue("password", acc.pass, { shouldValidate: true });
                  setServerError("");
                }}
              >
                {acc.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="login-footer">
          <Link className="text-button" href="/store">
            Open public storefront →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="login-page" />}>
      <LoginForm />
    </Suspense>
  );
}
