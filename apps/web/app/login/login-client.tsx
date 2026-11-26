"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Box, LockKeyhole, Sparkles } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  resolvePostAuthRedirect,
  useAuth,
} from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/format";
import "../auth.css";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(160),
  email: z.string().trim().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, ready, login, loginDemoOwner, register: registerAccount } = useAuth();
  const [demoPending, startDemoTransition] = useTransition();
  const [serverError, setServerError] = useState("");
  const [mode, setMode] = useState<"login" | "register">(() =>
    searchParams.get("mode") === "register" ? "register" : "login"
  );

  const rawNext = searchParams.get("next");

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const regForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", password: "" },
  });

  useEffect(() => {
    if (ready && user) {
      router.replace(resolvePostAuthRedirect(user, rawNext));
    }
  }, [ready, user, rawNext, router]);

  async function onLoginSubmit(values: LoginValues) {
    setServerError("");
    try {
      const signedUser = await login(values.email, values.password);
      router.replace(resolvePostAuthRedirect(signedUser, rawNext));
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError("Unable to reach authentication service");
      }
    }
  }

  async function onRegisterSubmit(values: RegisterValues) {
    setServerError("");
    try {
      const createdUser = await registerAccount(
        values.fullName,
        values.email,
        values.password
      );
      router.replace(resolvePostAuthRedirect(createdUser, rawNext));
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError("Unable to create account right now");
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
            <small className="muted">
              Unified Account · Storefront &amp; Merchant Workspace
            </small>
          </div>
        </div>

        <div className="login-tabs" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={cn("login-tab", mode === "login" && "active")}
            onClick={() => {
              setMode("login");
              setServerError("");
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            className={cn("login-tab", mode === "register" && "active")}
            onClick={() => {
              setMode("register");
              setServerError("");
            }}
          >
            Create Account
          </button>
        </div>

        <div className="login-tab-stage">
          {mode === "login" ? (
            <form
              className="form-stack"
              onSubmit={loginForm.handleSubmit(onLoginSubmit)}
              noValidate
            >
              <div className="ui-field">
                <label className="ui-field-label" htmlFor="login-email">
                  Email address
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...loginForm.register("email")}
                />
                {loginForm.formState.errors.email ? (
                  <span className="ui-field-error">
                    {loginForm.formState.errors.email.message}
                  </span>
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
                  {...loginForm.register("password")}
                />
                {loginForm.formState.errors.password ? (
                  <span className="ui-field-error">
                    {loginForm.formState.errors.password.message}
                  </span>
                ) : null}
              </div>

              {serverError ? (
                <div className="login-alert" role="alert">
                  <LockKeyhole size={15} />
                  <span>{serverError}</span>
                </div>
              ) : null}

              <Button
                variant="primary"
                size="lg"
                type="submit"
                disabled={loginForm.formState.isSubmitting}
              >
                {loginForm.formState.isSubmitting ? "Signing in..." : "Sign in"}
                <ArrowRight size={15} />
              </Button>
            </form>
          ) : (
            <form
              className="form-stack"
              onSubmit={regForm.handleSubmit(onRegisterSubmit)}
              noValidate
            >
              <div className="ui-field">
                <label className="ui-field-label" htmlFor="reg-name">
                  Full name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Nguyen Minh Anh"
                  {...regForm.register("fullName")}
                />
                {regForm.formState.errors.fullName ? (
                  <span className="ui-field-error">
                    {regForm.formState.errors.fullName.message}
                  </span>
                ) : null}
              </div>

              <div className="ui-field">
                <label className="ui-field-label" htmlFor="reg-email">
                  Email address
                </label>
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...regForm.register("email")}
                />
                {regForm.formState.errors.email ? (
                  <span className="ui-field-error">
                    {regForm.formState.errors.email.message}
                  </span>
                ) : null}
              </div>

              <div className="ui-field">
                <label className="ui-field-label" htmlFor="reg-password">
                  Password (8+ characters)
                </label>
                <input
                  id="reg-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  {...regForm.register("password")}
                />
                {regForm.formState.errors.password ? (
                  <span className="ui-field-error">
                    {regForm.formState.errors.password.message}
                  </span>
                ) : null}
              </div>

              {serverError ? (
                <div className="login-alert" role="alert">
                  <LockKeyhole size={15} />
                  <span>{serverError}</span>
                </div>
              ) : null}

              <Button
                variant="primary"
                size="lg"
                type="submit"
                disabled={regForm.formState.isSubmitting}
              >
                <Sparkles size={14} />
                {regForm.formState.isSubmitting
                  ? "Creating account..."
                  : "Create shopping account"}
              </Button>
            </form>
          )}
        </div>

        <div className="login-demo-box">
          <span className="muted">
            Try an isolated Admin Demo sandbox (auto-clears after 2 hours; main store stays untouched):
          </span>
          <div className="button-row">
            <Button
              size="sm"
              variant="secondary"
              disabled={demoPending}
              onClick={() => {
                setServerError("");
                startDemoTransition(async () => {
                  try {
                    const demoUser = await loginDemoOwner();
                    router.replace(resolvePostAuthRedirect(demoUser, rawNext));
                  } catch (err) {
                    if (err instanceof ApiError) {
                      setServerError(err.message);
                    } else {
                      setServerError("Unable to start Admin Demo workspace");
                    }
                  }
                });
              }}
            >
              <Sparkles size={13} />
              {demoPending ? "Starting Admin Demo..." : "Admin Demo"}
            </Button>
          </div>
        </div>

        <div className="login-footer">
          <Link className="text-button" href="/">
            Back to public storefront →
          </Link>
        </div>
      </div>
    </div>
  );
}
