import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/skills/EmptyState";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  deleteNotificationFn,
  listAdminNotifications,
  markAllNotificationsReadFn,
  markNotificationReadFn,
} from "@/lib/notifications.functions";
import { formatDate } from "@/lib/format";

const NOTIFICATION_TARGETS: Record<string, string> = {
  certificate: "/admin/certificates",
  support_ticket: "/admin/support",
  skill_request: "/admin/skills",
  badge_appeal: "/admin/badges",
  retake_request: "/admin/assessments",
};

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — LUA admin" },
      { name: "description", content: "Platform alerts for certificates, requests and appeals." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminNotificationsPage,
});

function AdminNotificationsPage() {
  const queryClient = useQueryClient();
  const fetchNotifications = useServerFn(listAdminNotifications);
  const markRead = useServerFn(markNotificationReadFn);
  const markAllRead = useServerFn(markAllNotificationsReadFn);
  const deleteOne = useServerFn(deleteNotificationFn);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: () => fetchNotifications(),
  });
  const unreadCount = (data ?? []).filter((n) => !n.isRead).length;

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const readMutation = useMutation({
    mutationFn: (id: string) => markRead({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-notifications"] }),
  });
  const readAllMutation = useMutation({
    mutationFn: () => markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-notifications"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => deleteOne({ data: { id } }))),
    onSuccess: () => {
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not delete notification(s)."),
  });

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <Breadcrumbs items={[{ label: "Admin", to: "/admin" }, { label: "Notifications" }]} />
        <PageHeader
          eyebrow="Admin"
          title="Notifications"
          subtitle="Platform alerts — new certificates awaiting review, skill requests, appeals, and more."
          actions={
            <div className="flex items-center gap-4">
              {selected.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-destructive hover:text-destructive"
                  onClick={() => deleteMutation.mutate(Array.from(selected))}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete ({selected.size})
                </Button>
              )}
              {unreadCount > 0 && (
                <button
                  onClick={() => readAllMutation.mutate()}
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
              title="Couldn't load notifications"
              description="Please try again."
              onRetry={() => refetch()}
            />
          ) : data?.length ? (
            data.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 rounded-2xl border p-4 shadow-soft transition hover:border-primary/40 ${
                  !n.isRead ? "border-primary/30 bg-primary/5" : "border-border/70 bg-card"
                }`}
              >
                <Checkbox
                  checked={selected.has(n.id)}
                  onCheckedChange={() => toggleSelected(n.id)}
                  className="mt-1"
                  aria-label={`Select ${n.title}`}
                />
                <Link
                  to={NOTIFICATION_TARGETS[n.targetType ?? ""] ?? "/admin"}
                  onClick={() => !n.isRead && readMutation.mutate(n.id)}
                  className="min-w-0 flex-1"
                >
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  {n.body && <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>}
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {formatDate(n.createdAt) ?? ""}
                  </p>
                </Link>
                <button
                  onClick={() => deleteMutation.mutate([n.id])}
                  aria-label="Delete notification"
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          ) : (
            <EmptyState
              title="No notifications"
              description="Platform alerts will show up here as they happen."
            />
          )}
        </div>
      </main>
    </DashboardChrome>
  );
}
