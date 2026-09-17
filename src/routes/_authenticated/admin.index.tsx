import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Award, Bell, LifeBuoy } from "lucide-react";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { listPendingCertificateReviews } from "@/lib/certificate.functions";
import { listTicketsAdmin } from "@/lib/support.functions";
import { listAdminNotifications } from "@/lib/notifications.functions";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin — LUA" },
      { name: "description", content: "Platform overview for LUA employees." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminOverviewPage,
});

function AdminOverviewPage() {
  const fetchCertReviews = useServerFn(listPendingCertificateReviews);
  const fetchTickets = useServerFn(listTicketsAdmin);
  const fetchNotifications = useServerFn(listAdminNotifications);

  const {
    data: certReviews,
    isLoading: certLoading,
    isError: certErr,
    refetch: refetchCert,
  } = useQuery({
    queryKey: ["admin-certificate-reviews"],
    queryFn: () => fetchCertReviews(),
  });
  const {
    data: tickets,
    isLoading: ticketsLoading,
    isError: ticketsErr,
    refetch: refetchTickets,
  } = useQuery({
    queryKey: ["admin-tickets", "open"],
    queryFn: () => fetchTickets({ data: { status: "open" } }),
  });
  const {
    data: notifications,
    isLoading: notificationsLoading,
    isError: notificationsErr,
    refetch: refetchNotifications,
  } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: () => fetchNotifications(),
  });

  const pendingCerts = (certReviews ?? []).filter((c) => c.status === "pending").length;
  const openTickets = (tickets ?? []).length;
  const recentNotifications = (notifications ?? []).slice(0, 5);
  const loading = certLoading || ticketsLoading || notificationsLoading;
  const failed = certErr || ticketsErr || notificationsErr;
  function retryAll() {
    refetchCert();
    refetchTickets();
    refetchNotifications();
  }

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <PageHeader
          eyebrow="Admin"
          title="Overview"
          subtitle="What needs your attention right now."
        />

        {loading ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <LoadingSkeleton className="h-28" />
            <LoadingSkeleton className="h-28" />
          </div>
        ) : failed ? (
          <div className="mt-8">
            <ErrorState
              title="Couldn't load the overview"
              description="Please try again."
              onRetry={retryAll}
            />
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link
              to="/admin/certificates"
              className="rounded-2xl border border-border/70 bg-card p-6 shadow-soft transition hover:border-primary/40 hover:shadow-elevated"
            >
              <div className="flex items-center justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand text-primary-foreground">
                  <Award className="h-5 w-5" />
                </div>
                <span className="text-3xl font-bold tracking-tight">{pendingCerts}</span>
              </div>
              <p className="mt-4 text-sm font-semibold text-foreground">
                Certificates awaiting review
              </p>
              <p className="text-xs text-muted-foreground">Candidate uploads pending a decision.</p>
            </Link>

            <Link
              to="/admin/support"
              className="rounded-2xl border border-border/70 bg-card p-6 shadow-soft transition hover:border-primary/40 hover:shadow-elevated"
            >
              <div className="flex items-center justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand text-primary-foreground">
                  <LifeBuoy className="h-5 w-5" />
                </div>
                <span className="text-3xl font-bold tracking-tight">{openTickets}</span>
              </div>
              <p className="mt-4 text-sm font-semibold text-foreground">Open support tickets</p>
              <p className="text-xs text-muted-foreground">Candidates waiting on a reply.</p>
            </Link>
          </div>
        )}

        <section className="mt-10">
          <div className="mb-3 flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Recent activity
            </h2>
          </div>
          {loading ? (
            <LoadingSkeleton className="h-40" />
          ) : failed ? (
            <ErrorState
              title="Couldn't load recent activity"
              description="Please try again."
              onRetry={retryAll}
            />
          ) : recentNotifications.length ? (
            <div className="space-y-2">
              {recentNotifications.map((n) => (
                <div key={n.id} className="rounded-xl border border-border/70 bg-card p-4">
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {formatDate(n.createdAt) ?? ""}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
              Nothing new right now.
            </p>
          )}
        </section>
      </main>
    </DashboardChrome>
  );
}
