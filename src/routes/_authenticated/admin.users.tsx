import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, ChevronRight } from "lucide-react";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchBar } from "@/components/shared/SearchBar";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { listUsers } from "@/lib/users.functions";
import { formatDate } from "@/lib/format";
import { statusMeta } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "Users — LUA admin" },
      { name: "description", content: "Search and manage LUA candidate accounts." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UsersAdminPage,
});

function UsersAdminPage() {
  const fetchUsers = useServerFn(listUsers);
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => fetchUsers({ data: { search: search.trim() || undefined } }),
  });

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <Breadcrumbs items={[{ label: "Admin", to: "/admin" }, { label: "Candidates" }]} />
        <PageHeader
          eyebrow="Admin"
          title="Candidates"
          subtitle="Search any candidate's profile, verification status and activity."
        />

        <div className="mt-8">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by name or email…" />
        </div>

        <div className="mt-6 space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <LoadingSkeleton key={i} className="h-20" />)
          ) : isError ? (
            <ErrorState
              title="Couldn't load candidates"
              description="Please try again."
              onRetry={() => refetch()}
            />
          ) : data?.length ? (
            data.map((u) => (
              <Link
                key={u.id}
                to="/admin/users/$id"
                params={{ id: u.id }}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-soft transition hover:border-primary/40 hover:shadow-elevated"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">{u.fullName ?? u.email}</p>
                    {u.roles.includes("admin") && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                        Admin
                      </span>
                    )}
                    {u.bannedUntil &&
                      (() => {
                        const suspended = statusMeta("suspended");
                        const SuspendedIcon = suspended.icon;
                        return (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${suspended.className}`}
                          >
                            <SuspendedIcon className="h-3 w-3" /> {suspended.label}
                          </span>
                        );
                      })()}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {u.email} · Joined {formatDate(u.createdAt) ?? "—"}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden text-right sm:block">
                    <p className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
                      <BadgeCheck className="h-4 w-4 text-primary" /> {u.skillsVerified}
                    </p>
                    <p className="text-[11px] text-muted-foreground">verified skills</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-border/70 bg-card p-10 text-center text-sm text-muted-foreground">
              No users match your search.
            </p>
          )}
        </div>
      </main>
    </DashboardChrome>
  );
}
