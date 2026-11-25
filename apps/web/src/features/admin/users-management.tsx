"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Shield } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/data-display";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { FormDialog, FormDialogField } from "@/components/ui/form-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError, apiFetch } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import type { AdminUserRecord, PageResponse, RoleSummary } from "@/types/auth";

const createUserSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(160),
  email: z.string().trim().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  role: z.string().min(1, "Role is required"),
});

type CreateUserValues = z.infer<typeof createUserSchema>;

export function UsersManagement({ notify }: { notify: (msg: string) => void }) {
  const { user: currentUser, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const canWrite = hasPermission("users:write");

  const usersQuery = useQuery({
    queryKey: ["admin-users", page],
    queryFn: () =>
      apiFetch<PageResponse<AdminUserRecord>>(`/api/v1/admin/users?page=${page}&size=20`),
    placeholderData: keepPreviousData,
  });

  const rolesQuery = useQuery({
    queryKey: ["admin-roles"],
    queryFn: () => apiFetch<RoleSummary[]>("/api/v1/admin/roles"),
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateUserValues) =>
      apiFetch<AdminUserRecord>("/api/v1/admin/users", {
        method: "POST",
        body: {
          fullName: values.fullName,
          email: values.email,
          password: values.password,
          roles: [values.role],
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setInviteOpen(false);
      reset();
      notify("Admin user created");
    },
    onError: (err) => {
      setSubmitError(err instanceof ApiError ? err.message : "Failed to create user");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      userId,
      patch,
    }: {
      userId: string;
      patch: { roles?: string[]; status?: string };
    }) =>
      apiFetch<AdminUserRecord>(`/api/v1/admin/users/${userId}`, {
        method: "PATCH",
        body: patch,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      notify("User permissions updated");
    },
    onError: (err) => {
      notify(err instanceof ApiError ? err.message : "Failed to update user");
    },
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { fullName: "", email: "", password: "", role: "VIEWER" },
  });

  const roles = rolesQuery.data || [];
  const rowRoleItems = roles.map((role) => ({
    value: role.code,
    label: role.code,
  }));
  const modalRoleOptions = roles.length
    ? roles
    : [
        { code: "ADMIN", name: "Admin" },
        { code: "CATALOG_MANAGER", name: "Catalog Manager" },
        { code: "CONTENT_EDITOR", name: "Content Editor" },
        { code: "ORDER_MANAGER", name: "Order Manager" },
        { code: "VIEWER", name: "Viewer" },
      ];
  const modalRoleItems = modalRoleOptions.map((role) => ({
    value: role.code,
    label: `${role.code} — ${role.name}`,
  }));

  const columns: DataTableColumn<AdminUserRecord>[] = [
    {
      id: "name",
      header: "Name",
      cell: (member) => (
        <>
          <strong>{member.fullName}</strong>
          {member.id === currentUser?.id ? (
            <Badge tone="accent" className="ml-badge">
              You
            </Badge>
          ) : null}
        </>
      ),
    },
    { id: "email", header: "Email", cell: (member) => member.email },
    {
      id: "role",
      header: "Role",
      cell: (member) => {
        const isSelf = member.id === currentUser?.id;
        const isCustomer = member.roles.length === 0;
        const primaryRole = member.roles[0] || "CUSTOMER";
        if (isCustomer) {
          return <Badge tone="neutral">Customer</Badge>;
        }
        return canWrite && !isSelf && roles.length > 0 ? (
          <Select
            items={rowRoleItems}
            value={primaryRole}
            disabled={updateMutation.isPending}
            onValueChange={(next) => {
              if (!next || next === primaryRole) return;
              updateMutation.mutate({
                userId: member.id,
                patch: { roles: [next] },
              });
            }}
          >
            <SelectTrigger size="sm" aria-label={`Role for ${member.fullName}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rowRoleItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge tone="accent">{primaryRole}</Badge>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      cell: (member) => (
        <StatusBadge
          status={member.status === "ACTIVE" ? "Active" : "Disabled"}
        />
      ),
    },
    {
      id: "lastLogin",
      header: "Last login",
      cell: (member) => (
        <span className="muted">
          {member.lastLoginAt ? formatDateTime(member.lastLoginAt) : "Never"}
        </span>
      ),
    },
    ...(canWrite
      ? [
          {
            id: "access",
            header: "Access",
            align: "right" as const,
            cell: (member: AdminUserRecord) =>
              member.id !== currentUser?.id ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={updateMutation.isPending}
                  onClick={() =>
                    updateMutation.mutate({
                      userId: member.id,
                      patch: {
                        status: member.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
                      },
                    })
                  }
                >
                  {member.status === "ACTIVE" ? "Disable" : "Activate"}
                </Button>
              ) : (
                <span className="muted">—</span>
              ),
          },
        ]
      : []),
  ];

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>Users &amp; Permissions</h1>
          <p>Manage workspace members, RBAC role assignments, and account status.</p>
        </div>
        {canWrite ? (
          <Button
            variant="primary"
            onClick={() => {
              setSubmitError("");
              setInviteOpen(true);
            }}
          >
            <Plus size={15} /> Create admin user
          </Button>
        ) : null}
      </div>

      {usersQuery.isError ? (
        <Empty
          title="Unable to load users"
          text={
            usersQuery.error instanceof ApiError
              ? usersQuery.error.message
              : "Check your session and try again."
          }
          icon={<Shield size={18} />}
        />
      ) : (
        <DataTable
          columns={columns}
          data={usersQuery.data?.items || []}
          getRowKey={(member) => member.id}
          isLoading={usersQuery.isLoading}
          isFetching={usersQuery.isPlaceholderData}
          paginateClientSide={false}
          page={page + 1}
          pageSize={usersQuery.data?.size || 20}
          totalItems={usersQuery.data?.totalElements || 0}
          onPageChange={(next) => setPage(next - 1)}
          emptyState={
            <Empty
              title="No admin users found"
              text="Invite a collaborator to manage the workspace."
              icon={<Shield size={18} />}
            />
          }
        />
      )}

      {inviteOpen ? (
        <FormDialog
          open
          onOpenChange={setInviteOpen}
          title="Create admin user"
          description="Assign an RBAC role and initial password for the collaborator."
          submitLabel={createMutation.isPending ? "Creating..." : "Create user"}
          isSubmitting={createMutation.isPending}
          error={submitError}
          noValidate
          onSubmit={handleSubmit((vals) => {
            setSubmitError("");
            createMutation.mutate(vals);
          })}
        >
          <FormDialogField
            label="Full name"
            htmlFor="new-user-name"
            error={errors.fullName?.message}
          >
            <input id="new-user-name" {...register("fullName")} />
          </FormDialogField>

          <FormDialogField
            label="Email address"
            htmlFor="new-user-email"
            error={errors.email?.message}
          >
            <input id="new-user-email" type="email" {...register("email")} />
          </FormDialogField>

          <FormDialogField
            label="Initial password"
            htmlFor="new-user-pass"
            error={errors.password?.message}
          >
            <input id="new-user-pass" type="password" {...register("password")} />
          </FormDialogField>

          <FormDialogField label="Role" htmlFor="new-user-role">
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Select
                  items={modalRoleItems}
                  value={field.value}
                  onValueChange={(next) => next && field.onChange(next)}
                >
                  <SelectTrigger id="new-user-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modalRoleItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormDialogField>
        </FormDialog>
      ) : null}
    </>
  );
}
