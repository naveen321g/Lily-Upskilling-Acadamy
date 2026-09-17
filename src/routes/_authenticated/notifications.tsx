import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/skills/EmptyState";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { listMyCertificates } from "@/lib/certificate.functions";
import { listMyBadgeAppeals, listMyBadges } from "@/lib/badges.functions";
import { listMySkillRequests } from "@/lib/skills.functions";
import { listMyRetakeRequests } from "@/lib/retake.functions";
import { buildNotificationFeed } from "@/lib/notifications-feed";
import { dismiss, isDismissed, isSeen, markAllSeen, markSeen } from "@/lib/notifications-read";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [{ title: "Notifications — LUA" }, { name: "robots", content: "noindex" }],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const navigate = useNavigate();
  const fetchCertificates = useServerFn(listMyCertificates);
  const fetchBadges = useServerFn(listMyBadges);
  const fetchSkillRequests = useServerFn(listMySkillRequests);
  const fetchBadgeAppeals = useServerFn(listMyBadgeAppeals);
  const fetchRetakeRequests = useServerFn(listMyRetakeRequests);
  const [, forceRender] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function deleteSelected() {
    dismiss(Array.from(selected));
    setSelected(new Set());
    forceRender((v) => v + 1);
  }

  const {
    data: certificates,
    isLoading: certsLoading,
    isError: certsErr,
    refetch: refetchCerts,
  } = useQuery({
    queryKey: ["my-certificates"],
    queryFn: () => fetchCertificates(),
  });
  const {
    data: badges,
    isLoading: badgesLoading,
    isError: badgesErr,
    refetch: refetchBadges,
  } = useQuery({
    queryKey: ["my-badges"],
    queryFn: () => fetchBadges(),
  });
  const {
    data: skillRequests,
    isLoading: requestsLoading,
    isError: requestsErr,
    refetch: refetchRequests,
  } = useQuery({
    queryKey: ["my-skill-requests"],
    queryFn: () => fetchSkillRequests(),
  });
  const {
    data: badgeAppeals,
    isLoading: appealsLoading,
    isError: appealsErr,
    refetch: refetchAppeals,
  } = useQuery({
    queryKey: ["my-badge-appeals"],
    queryFn: () => fetchBadgeAppeals(),
  });
  const {
    data: retakeRequests,
    isLoading: retakesLoading,
    isError: retakesErr,
    refetch: refetchRetakes,
  } = useQuery({
    queryKey: ["my-retake-requests"],
    queryFn: () => fetchRetakeRequests(),
  });
  const isLoading =
    certsLoading || badgesLoading || requestsLoading || appealsLoading || retakesLoading;
  const isError = certsErr || badgesErr || requestsErr || appealsErr || retakesErr;
  function retryAll() {
    refetchCerts();
    refetchBadges();
    refetchRequests();
    refetchAppeals();
    refetchRetakes();
  }

  const items = buildNotificationFeed({
    certificates: certificates ?? [],
    badges: badges ?? [],
    skillRequests: skillRequests ?? [],
    retakeRequests: retakeRequests ?? [],
    badgeAppeals: badgeAppeals ?? [],
  }).filter((n) => !isDismissed(n.id));
  const unreadCount = items.filter((n) => !isSeen(n.id)).length;

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <Breadcrumbs
          items={[{ label: "Dashboard", to: "/dashboard" }, { label: "Notifications" }]}
        />
        <PageHeader
          eyebrow="Updates"
          title="Notifications"
          subtitle="Every decision made on your certificates, badges and skill requests."
          actions={
            <div className="flex items-center gap-4">
              {selected.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-destructive hover:text-destructive"
                  onClick={deleteSelected}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete ({selected.size})
                </Button>
              )}
              {unreadCount > 0 && (
                <button
                  onClick={() => {
                    markAllSeen(items.map((n) => n.id));
                    forceRender((v) => v + 1);
                  }}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
          }
        />

        <div className="mt-8 space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <LoadingSkeleton key={i} className="h-20" />)
          ) : isError ? (
            <ErrorState
              title="Couldn't load your notifications"
              description="Please try again."
              onRetry={retryAll}
            />
          ) : items.length ? (
            items.map((n) => {
              const unread = !isSeen(n.id);
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 rounded-2xl border p-4 shadow-soft transition hover:border-primary/40 ${
                    unread ? "border-primary/30 bg-primary/5" : "border-border/70 bg-card"
                  }`}
                >
                  <Checkbox
                    checked={selected.has(n.id)}
                    onCheckedChange={() => toggleSelected(n.id)}
                    className="mt-1"
                    aria-label={`Select ${n.title}`}
                  />
                  <Link
                    to={n.to}
                    params={n.params}
                    onClick={() => {
                      if (unread) {
                        markSeen(n.id);
                        forceRender((v) => v + 1);
                      }
                    }}
                    className="min-w-0 flex-1"
                  >
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    {n.body && <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {formatDate(n.createdAt) ?? ""}
                    </p>
                  </Link>
                  <button
                    onClick={() => {
                      dismiss([n.id]);
                      forceRender((v) => v + 1);
                    }}
                    aria-label="Delete notification"
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          ) : (
            <EmptyState
              title="No notifications yet"
              description="You'll see certificate decisions, badge updates and skill request outcomes here."
              actionLabel="Go to Dashboard"
              onAction={() => navigate({ to: "/dashboard" })}
            />
          )}
        </div>
      </main>
    </DashboardChrome>
  );
}
