import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History, ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchBar } from "@/components/shared/SearchBar";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { listAuditLog } from "@/lib/admin.functions";
import { listUsers, setUserRole } from "@/lib/users.functions";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Settings — LUA admin" },
      { name: "description", content: "Manage employee roles and review the admin audit log." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminSettingsPage,
});

const MANAGEABLE_ROLES = ["admin", "reviewer"] as const;
const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  reviewer: "Reviewer",
};

function AdminSettingsPage() {
  const fetchUsers = useServerFn(listUsers);
  const fetchAuditLog = useServerFn(listAuditLog);
  const setRole = useServerFn(setUserRole);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const {
    data: users,
    isLoading: usersLoading,
    isError: usersError,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => fetchUsers({ data: { search: search.trim() || undefined } }),
    enabled: search.trim().length > 0,
  });

  const {
    data: auditLog,
    isLoading: auditLoading,
    isError: auditError,
    refetch: refetchAudit,
  } = useQuery({
    queryKey: ["admin-audit-log"],
    queryFn: () => fetchAuditLog(),
  });

  const roleMutation = useMutation({
    mutationFn: (args: { userId: string; role: "admin" | "reviewer"; grant: boolean }) =>
      setRole({ data: args }),
    onSuccess: (_, args) => {
      toast.success(`${ROLE_LABEL[args.role]} ${args.grant ? "granted" : "removed"}.`);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-log"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not update role."),
  });

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <Breadcrumbs items={[{ label: "Admin", to: "/admin" }, { label: "Settings" }]} />
        <PageHeader
          eyebrow="Admin"
          title="Settings"
          subtitle="Manage who has employee access, and review a record of every admin action."
        />

        <section className="mt-10">
          <div className="mb-3 flex items-center gap-2">
            <UserCog className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Team & roles
            </h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Search for a candidate to grant or remove Admin (full access) or Reviewer (question bank
            review) access.
          </p>
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by name or email to manage roles…"
          />
          <div className="mt-4 space-y-2">
            {search.trim().length === 0 ? null : usersLoading ? (
              Array.from({ length: 3 }).map((_, i) => <LoadingSkeleton key={i} className="h-16" />)
            ) : usersError ? (
              <ErrorState
                title="Couldn't load candidates"
                description="Please try again."
                onRetry={() => refetchUsers()}
              />
            ) : users?.length ? (
              users.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{u.fullName ?? u.email}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {MANAGEABLE_ROLES.map((role) => {
                      const has = u.roles.includes(role);
                      return (
                        <Button
                          key={role}
                          size="sm"
                          variant={has ? "default" : "outline"}
                          disabled={roleMutation.isPending}
                          onClick={() => roleMutation.mutate({ userId: u.id, role, grant: !has })}
                        >
                          <ShieldCheck className="h-4 w-4" />
                          {has ? `${ROLE_LABEL[role]} — remove` : `Make ${ROLE_LABEL[role]}`}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
                No candidates match that search.
              </p>
            )}
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Audit log
            </h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Every admin action — most recent first.
          </p>
          <div className="space-y-2">
            {auditLoading ? (
              Array.from({ length: 5 }).map((_, i) => <LoadingSkeleton key={i} className="h-12" />)
            ) : auditError ? (
              <ErrorState
                title="Couldn't load the audit log"
                description="Please try again."
                onRetry={() => refetchAudit()}
              />
            ) : auditLog?.length ? (
              auditLog.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-4 py-2.5 text-sm"
                >
                  <span className="text-foreground">
                    <span className="font-medium">{entry.actorName}</span> — {entry.action}
                    {entry.targetType && (
                      <span className="text-muted-foreground"> · {entry.targetType}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(entry.createdAt) ?? "—"}
                  </span>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
                No admin actions recorded yet.
              </p>
            )}
          </div>
        </section>
      </main>
    </DashboardChrome>
  );
}
