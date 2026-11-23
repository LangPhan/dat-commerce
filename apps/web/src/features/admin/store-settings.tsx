"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Empty, Skeleton } from "@/components/ui/data-display";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError, apiFetch } from "@/lib/api-client";
import type { StoreInfo } from "@/types/auth";

const storeSchema = z.object({
  name: z.string().trim().min(1, "Store name is required").max(160),
  defaultCurrency: z.string().trim().min(3).max(8),
  locale: z.string().trim().min(2).max(16),
  timezone: z.string().trim().min(2).max(64),
  contactEmail: z.string().trim().email("Valid email required").or(z.literal("")),
  publicDomain: z.string().trim().max(255),
});

type StoreFormValues = z.infer<typeof storeSchema>;

export function StoreSettingsView({
  mode,
  notify,
}: {
  mode: "general" | "store-information";
  notify: (msg: string) => void;
}) {
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("store:write");
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState("");

  const storeQuery = useQuery({
    queryKey: ["admin-store"],
    queryFn: () => apiFetch<StoreInfo>("/api/v1/admin/store"),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StoreFormValues>({
    resolver: zodResolver(storeSchema),
    defaultValues: {
      name: "",
      defaultCurrency: "USD",
      locale: "en-US",
      timezone: "America/Los_Angeles",
      contactEmail: "",
      publicDomain: "",
    },
  });

  useEffect(() => {
    if (storeQuery.data) {
      reset({
        name: storeQuery.data.name,
        defaultCurrency: storeQuery.data.defaultCurrency,
        locale: storeQuery.data.locale,
        timezone: storeQuery.data.timezone,
        contactEmail: storeQuery.data.contactEmail || "",
        publicDomain: storeQuery.data.publicDomain || "",
      });
    }
  }, [storeQuery.data, reset]);

  const mutation = useMutation({
    mutationFn: (values: StoreFormValues) =>
      apiFetch<StoreInfo>("/api/v1/admin/store", {
        method: "PATCH",
        body: values,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["admin-store"], updated);
      notify("Store configuration updated");
      setServerError("");
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Failed to save store settings");
    },
  });

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>{mode === "general" ? "General" : "Store Information"}</h1>
          <p>
            Configure store identity, default currency, locale, and timezone stored in PostgreSQL.
          </p>
        </div>
      </div>

      {storeQuery.isLoading ? (
        <Skeleton rows={4} />
      ) : storeQuery.isError ? (
        <Empty
          title="Unable to load store configuration"
          text={
            storeQuery.error instanceof ApiError
              ? storeQuery.error.message
              : "Check API connectivity."
          }
        />
      ) : (
        <form
          className="panel form-stack utility-form"
          onSubmit={handleSubmit((vals) => mutation.mutate(vals))}
          noValidate
        >
          {mode === "general" ? (
            <>
              <div className="ui-field">
                <label className="ui-field-label" htmlFor="store-currency">
                  Currency
                </label>
                <select id="store-currency" disabled={!canWrite} {...register("defaultCurrency")}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="VND">VND</option>
                </select>
              </div>

              <div className="ui-field">
                <label className="ui-field-label" htmlFor="store-locale">
                  Locale
                </label>
                <input id="store-locale" disabled={!canWrite} {...register("locale")} />
                {errors.locale ? (
                  <span className="ui-field-error">{errors.locale.message}</span>
                ) : null}
              </div>

              <div className="ui-field">
                <label className="ui-field-label" htmlFor="store-tz">
                  Timezone
                </label>
                <input id="store-tz" disabled={!canWrite} {...register("timezone")} />
                {errors.timezone ? (
                  <span className="ui-field-error">{errors.timezone.message}</span>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="ui-field">
                <label className="ui-field-label" htmlFor="store-name">
                  Store name
                </label>
                <input id="store-name" disabled={!canWrite} {...register("name")} />
                {errors.name ? (
                  <span className="ui-field-error">{errors.name.message}</span>
                ) : null}
              </div>

              <div className="ui-field">
                <label className="ui-field-label" htmlFor="store-email">
                  Contact email
                </label>
                <input
                  id="store-email"
                  type="email"
                  disabled={!canWrite}
                  {...register("contactEmail")}
                />
                {errors.contactEmail ? (
                  <span className="ui-field-error">{errors.contactEmail.message}</span>
                ) : null}
              </div>

              <div className="ui-field">
                <label className="ui-field-label" htmlFor="store-domain">
                  Public domain
                </label>
                <input id="store-domain" disabled={!canWrite} {...register("publicDomain")} />
              </div>
            </>
          )}

          {serverError ? (
            <p className="danger" role="alert">
              {serverError}
            </p>
          ) : null}

          {canWrite ? (
            <div>
              <Button variant="primary" type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving..." : "Save settings"}
              </Button>
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 12 }}>
              Read-only mode: requires <code>store:write</code> permission to modify store settings.
            </p>
          )}
        </form>
      )}
    </>
  );
}
