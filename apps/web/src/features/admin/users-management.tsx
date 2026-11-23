"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Shield } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, Pagination, Skeleton } from "@/components/ui/data-display";
import { Modal } from "@/components/ui/dialog";
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

      {usersQuery.isLoading ? (
        <Skeleton rows={4} />
      ) : usersQuery.isError ? (
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
        <div className="admin-table-panel table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last login</th>
                {canWrite ? <th>Access</th> : null}
              </tr>
            </thead>
            <tbody>
              {(usersQuery.data?.items || []).map((member) => {
                const isSelf = member.id === currentUser?.id;
                const primaryRole = member.roles[0] || "VIEWER";
                return (
                  <tr key={member.id}>
                    <td>
                      <strong>{member.fullName}</strong>
                      {isSelf ? (
                        <Badge tone="accent" className="ml-badge">
                          You
                        </Badge>
                      ) : null}
                    </td>
                    <td>{member.email}</td>
                    <td>
                      {canWrite && !isSelf && roles.length > 0 ? (
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
                          <SelectTrigger
                            size="sm"
                            aria-label={`Role for ${member.fullName}`}
                          >
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
                      )}
                    </td>
                    <td>
                      <StatusBadge
                        status={member.status === "ACTIVE" ? "Active" : "Disabled"}
                      />
                    </td>
                    <td className="muted">
                      {member.lastLoginAt ? formatDateTime(member.lastLoginAt) : "Never"}
                    </td>
                    {canWrite ? (
                      <td>
                        {!isSelf ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={updateMutation.isPending}
                            onClick={() =>
                              updateMutation.mutate({
                                userId: member.id,
                                patch: {
                                  status:
                                    member.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
                                },
                              })
                            }
                          >
                            {member.status === "ACTIVE" ? "Disable" : "Activate"}
                          </Button>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {usersQuery.data ? (
            <div className="table-footer">
              <Pagination
                page={page + 1}
                totalItems={usersQuery.data.totalElements}
                pageSize={usersQuery.data.size}
                onPageChange={(next) => setPage(next - 1)}
              />
            </div>
          ) : null}
        </div>
      )}

      {inviteOpen ? (
        <Modal
          title="Create admin user"
          description="Assign an RBAC role and initial password for the collaborator."
          close={() => setInviteOpen(false)}
        >
          <form
            className="form-stack"
            onSubmit={handleSubmit((vals) => {
              setSubmitError("");
              createMutation.mutate(vals);
            })}
            noValidate
          >
            <div className="ui-field">
              <label className="ui-field-label" htmlFor="new-user-name">
                Full name
              </label>
              <input id="new-user-name" {...register("fullName")} />
              {errors.fullName ? (
                <span className="ui-field-error">{errors.fullName.message}</span>
              ) : null}
            </div>

            <div className="ui-field">
              <label className="ui-field-label" htmlFor="new-user-email">
                Email address
              </label>
              <input id="new-user-email" type="email" {...register("email")} />
              {errors.email ? (
                <span className="ui-field-error">{errors.email.message}</span>
              ) : null}
            </div>

            <div className="ui-field">
              <label className="ui-field-label" htmlFor="new-user-pass">
                Initial password
              </label>
              <input id="new-user-pass" type="password" {...register("password")} />
              {errors.password ? (
                <span className="ui-field-error">{errors.password.message}</span>
              ) : null}
            </div>

            <div className="ui-field">
              <label className="ui-field-label" htmlFor="new-user-role">
                Role
              </label>
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
            </div>

            {submitError ? (
              <p className="danger" role="alert">
                {submitError}
              </p>
            ) : null}

            <div className="modal-actions">
              <Button onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                type="submit"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create user"}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
