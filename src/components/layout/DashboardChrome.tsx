import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, BellRing, ClipboardCheck, Home, MoreHorizontal, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminStatus } from "@/lib/admin.functions";
import {
  deleteNotificationFn,
  listAdminNotifications,
  markAllNotificationsReadFn,
  markNotificationReadFn,
} from "@/lib/notifications.functions";
import { listMySkillRequests } from "@/lib/skills.functions";
import { listMyCertificates } from "@/lib/certificate.functions";
import { listMyBadgeAppeals, listMyBadges } from "@/lib/badges.functions";
import { listMyRetakeRequests } from "@/lib/retake.functions";
import { buildNotificationFeed } from "@/lib/notifications-feed";
import { dismiss, isDismissed, isSeen, markAllSeen, markSeen } from "@/lib/notifications-read";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { CandidateSidebar } from "./CandidateSidebar";
import { AdminSidebar } from "./AdminSidebar";
import { CommandPalette } from "./CommandPalette";

const NOTIFICATION_TARGETS: Record<string, string> = {
  certificate: "/admin/certificates",
  support_ticket: "/admin/support",
  skill_request: "/admin/skills",
  badge_appeal: "/admin/badges",
  retake_request: "/admin/assessments",
};

function AdminNotificationBell() {
  const fetchNotifications = useServerFn(listAdminNotifications);
  const markRead = useServerFn(markNotificationReadFn);
  const markAllRead = useServerFn(markAllNotificationsReadFn);
  const deleteOne = useServerFn(deleteNotificationFn);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: () => fetchNotifications(),
    refetchInterval: 60_000,
  });
  const unread = (data ?? []).filter((n) => !n.isRead);

  const readMutation = useMutation({
    mutationFn: (id: string) => markRead({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-notifications"] }),
  });
  const readAllMutation = useMutation({
    mutationFn: () => markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-notifications"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteOne({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-notifications"] }),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not delete notification."),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Admin notifications">
          {unread.length ? (
            <BellRing className="h-4 w-4 text-primary" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          {unread.length > 0 && (
            <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Notifications
          </span>
          <div className="flex items-center gap-3">
            {unread.length > 0 && (
              <button
                onClick={() => readAllMutation.mutate()}
                className="text-xs font-medium text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
        </div>
        {data?.length ? (
          data.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-1 rounded-sm px-2 py-1.5 text-sm ${!n.isRead ? "bg-primary/5" : ""}`}
            >
              <Link
                to={NOTIFICATION_TARGETS[n.targetType ?? ""] ?? "/dashboard"}
                onClick={() => !n.isRead && readMutation.mutate(n.id)}
                className="flex min-w-0 flex-1 flex-col items-start gap-0.5 whitespace-normal hover:opacity-90"
              >
                <span className="text-sm font-medium text-foreground">{n.title}</span>
                {n.body && <span className="text-xs text-muted-foreground">{n.body}</span>}
                <span className="text-[10px] text-muted-foreground">
                  {formatDate(n.createdAt) ?? ""}
                </span>
              </Link>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteMutation.mutate(n.id);
                }}
                aria-label="Delete notification"
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        ) : (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            No notifications yet.
          </p>
        )}
        {data && data.length > 0 && (
          <Link
            to="/admin/notifications"
            className="block border-t border-border/60 px-2 py-2 text-center text-xs font-medium text-primary hover:underline"
          >
            View all
          </Link>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CandidateNotificationBell() {
  const fetchCertificates = useServerFn(listMyCertificates);
  const fetchBadges = useServerFn(listMyBadges);
  const fetchSkillRequests = useServerFn(listMySkillRequests);
  const fetchBadgeAppeals = useServerFn(listMyBadgeAppeals);
  const fetchRetakeRequests = useServerFn(listMyRetakeRequests);
  const [, forceRender] = useState(0);

  const { data: certificates } = useQuery({
    queryKey: ["my-certificates"],
    queryFn: () => fetchCertificates(),
  });
  const { data: badges } = useQuery({ queryKey: ["my-badges"], queryFn: () => fetchBadges() });
  const { data: skillRequests } = useQuery({
    queryKey: ["my-skill-requests"],
    queryFn: () => fetchSkillRequests(),
  });
  const { data: badgeAppeals } = useQuery({
    queryKey: ["my-badge-appeals"],
    queryFn: () => fetchBadgeAppeals(),
  });
  const { data: retakeRequests } = useQuery({
    queryKey: ["my-retake-requests"],
    queryFn: () => fetchRetakeRequests(),
  });

  const items = buildNotificationFeed({
    certificates: certificates ?? [],
    badges: badges ?? [],
    skillRequests: skillRequests ?? [],
    badgeAppeals: badgeAppeals ?? [],
    retakeRequests: retakeRequests ?? [],
  }).filter((n) => !isDismissed(n.id));
  const unread = items.filter((n) => !isSeen(n.id));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          {unread.length ? (
            <BellRing className="h-4 w-4 text-primary" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          {unread.length > 0 && (
            <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Notifications
          </span>
          {unread.length > 0 && (
            <button
              onClick={() => {
                markAllSeen(items.map((n) => n.id));
                forceRender((v) => v + 1);
              }}
              className="text-xs font-medium text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        {items.length ? (
          items.slice(0, 6).map((n) => {
            const unreadItem = !isSeen(n.id);
            return (
              <div
                key={n.id}
                className={`flex items-start gap-1 rounded-sm px-2 py-1.5 text-sm ${unreadItem ? "bg-primary/5" : ""}`}
              >
                <Link
                  to={n.to}
                  params={n.params}
                  onClick={() => {
                    if (unreadItem) {
                      markSeen(n.id);
                      forceRender((v) => v + 1);
                    }
                  }}
                  className="flex min-w-0 flex-1 flex-col items-start gap-0.5 whitespace-normal hover:opacity-90"
                >
                  <span className="text-sm font-medium text-foreground">{n.title}</span>
                  {n.body && <span className="text-xs text-muted-foreground">{n.body}</span>}
                  <span className="text-[10px] text-muted-foreground">
                    {formatDate(n.createdAt) ?? ""}
                  </span>
                </Link>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismiss([n.id]);
                    forceRender((v) => v + 1);
                  }}
                  aria-label="Delete notification"
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        ) : (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            No notifications yet.
          </p>
        )}
        {items.length > 0 && (
          <Link
            to="/notifications"
            className="block border-t border-border/60 px-2 py-2 text-center text-xs font-medium text-primary hover:underline"
          >
            View all
          </Link>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TopBar({ isAdminSection }: { isAdminSection: boolean }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border/60 bg-background/80 px-4 backdrop-blur">
      <div className="flex items-center gap-1">
        <SidebarTrigger />
      </div>
      <div className="flex items-center gap-1">
        {isAdminSection ? (
          <>
            <CommandPalette />
            <AdminNotificationBell />
          </>
        ) : (
          <CandidateNotificationBell />
        )}
      </div>
    </header>
  );
}

const MOBILE_TABS = [
  { label: "Home", to: "/dashboard", icon: Home },
  { label: "Skills", to: "/skills", icon: Sparkles },
  { label: "Assessments", to: "/assessments", icon: ClipboardCheck },
];

function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { toggleSidebar } = useSidebar();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t border-border/60 bg-background/95 backdrop-blur md:hidden"
    >
      {MOBILE_TABS.map((tab) => {
        const active = pathname === tab.to || pathname.startsWith(`${tab.to}/`);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={`flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
              active ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icon className="h-5 w-5" />
            {tab.label}
          </Link>
        );
      })}
      <button
        onClick={toggleSidebar}
        className="flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground"
      >
        <MoreHorizontal className="h-5 w-5" />
        More
      </button>
    </nav>
  );
}

export function DashboardChrome({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdminSection = pathname.startsWith("/admin");

  const fetchAdminStatus = useServerFn(getAdminStatus);
  const { data: adminStatus } = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => fetchAdminStatus(),
    staleTime: 5 * 60_000,
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <SidebarProvider>
      {isAdminSection ? (
        <AdminSidebar onSignOut={signOut} />
      ) : (
        <CandidateSidebar onSignOut={signOut} isAdmin={Boolean(adminStatus?.isAdmin)} />
      )}
      <SidebarInset>
        <TopBar isAdminSection={isAdminSection} />
        <div className={!isAdminSection ? "pb-16 md:pb-0" : undefined}>{children}</div>
        {!isAdminSection && <MobileTabBar />}
      </SidebarInset>
    </SidebarProvider>
  );
}
