import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Award, Building2, Check, RefreshCcw, ShieldX, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchBar } from "@/components/shared/SearchBar";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listBadgeAppeals,
  listBadges,
  reissueBadge,
  revokeBadge,
  reviewBadgeAppeal,
} from "@/lib/badges.functions";
import type { AdminBadgeRecord } from "@/lib/badges-shared";
import type { AdminBadgeAppeal } from "@/lib/admin-shared";
import { formatDate } from "@/lib/format";
import { badgeState, statusMeta } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/admin/badges")({
  head: () => ({
    meta: [
      { title: "Badges — LUA admin" },
      {
        name: "description",
        content: "View, revoke and reissue candidate skill verification badges.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BadgesAdminPage,
});

const ALL = "all";

const TYPE_LABEL: Record<string, string> = {
  ai: "AI Skill Verified",
  certificate: "Certification Verified",
  institution: "Institution Verified",
};

function BadgeTypeIcon({ type }: { type: string }) {
  if (type === "ai") return <Sparkles className="h-4 w-4" />;
  if (type === "institution") return <Building2 className="h-4 w-4" />;
  return <Award className="h-4 w-4" />;
}

function BadgesAdminPage() {
  const fetchBadges = useServerFn(listBadges);
  const revoke = useServerFn(revokeBadge);
  const reissue = useServerFn(reissueBadge);
  const fetchAppeals = useServerFn(listBadgeAppeals);
  const reviewAppeal = useServerFn(reviewBadgeAppeal);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-badges"],
    queryFn: () => fetchBadges(),
  });
  const { data: appeals } = useQuery({
    queryKey: ["admin-badge-appeals"],
    queryFn: () => fetchAppeals(),
  });

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [revokeTarget, setRevokeTarget] = useState<AdminBadgeRecord | null>(null);
  const [reason, setReason] = useState("");
  const [rejectTarget, setRejectTarget] = useState<AdminBadgeAppeal | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const revokeMutation = useMutation({
    mutationFn: (args: { badgeId: string; reason?: string }) => revoke({ data: args }),
    onSuccess: () => {
      toast.success("Badge revoked.");
      queryClient.invalidateQueries({ queryKey: ["admin-badges"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not revoke badge."),
  });

  const reissueMutation = useMutation({
    mutationFn: (badgeId: string) => reissue({ data: { badgeId } }),
    onSuccess: () => {
      toast.success("Badge reissued.");
      queryClient.invalidateQueries({ queryKey: ["admin-badges"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not reissue badge."),
  });

  const appealMutation = useMutation({
    mutationFn: (args: {
      appealId: string;
      decision: "approved" | "rejected";
      adminNotes?: string;
    }) => reviewAppeal({ data: args }),
    onSuccess: (_, args) => {
      toast.success(
        args.decision === "approved" ? "Appeal approved — badge reinstated." : "Appeal rejected.",
      );
      queryClient.invalidateQueries({ queryKey: ["admin-badge-appeals"] });
      queryClient.invalidateQueries({ queryKey: ["admin-badges"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not update the appeal."),
    onSettled: () => {
      setRejectTarget(null);
      setRejectReason("");
    },
  });

  const pendingAppeals = (appeals ?? []).filter((a) => a.status === "pending");

  function confirmRejectAppeal() {
    if (!rejectTarget) return;
    appealMutation.mutate({
      appealId: rejectTarget.id,
      decision: "rejected",
      adminNotes: rejectReason.trim() || undefined,
    });
  }

  const filtered = useMemo(() => {
    let list = data ?? [];
    const q = search.trim().toLowerCase();
    if (q)
      list = list.filter(
        (b) => b.userName.toLowerCase().includes(q) || b.skillName.toLowerCase().includes(q),
      );
    if (typeFilter !== ALL) list = list.filter((b) => b.type === typeFilter);
    if (statusFilter !== ALL) list = list.filter((b) => b.status === statusFilter);
    return list;
  }, [data, search, typeFilter, statusFilter]);

  function confirmRevoke() {
    if (!revokeTarget) return;
    revokeMutation.mutate({ badgeId: revokeTarget.id, reason: reason.trim() || undefined });
    setRevokeTarget(null);
    setReason("");
  }

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <Breadcrumbs items={[{ label: "Admin", to: "/admin" }, { label: "Badges" }]} />
        <PageHeader
          eyebrow="Admin"
          title="Badges"
          subtitle="Every AI Skill Verified and Certification Verified badge issued to candidates."
        />

        {pendingAppeals.length > 0 && (
          <div className="mt-8 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Pending appeals ({pendingAppeals.length})
            </h2>
            {pendingAppeals.map((a) => (
              <div
                key={a.id}
                className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/40 dark:bg-amber-950/20"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {TYPE_LABEL[a.badgeType] ?? a.badgeType} · {a.skillName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.userName} · "{a.reason}"
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={appealMutation.isPending}
                    onClick={() => appealMutation.mutate({ appealId: a.id, decision: "approved" })}
                  >
                    <Check className="h-4 w-4" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => setRejectTarget(a)}
                  >
                    <X className="h-4 w-4" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by candidate or skill…"
          />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              <SelectItem value="ai">AI Skill Verified</SelectItem>
              <SelectItem value="certificate">Certification Verified</SelectItem>
              <SelectItem value="institution">Institution Verified</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="revoked">Revoked</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-6 space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <LoadingSkeleton key={i} className="h-20" />)
          ) : isError ? (
            <ErrorState
              title="Couldn't load badges"
              description="Please try again."
              onRetry={() => refetch()}
            />
          ) : filtered.length ? (
            filtered.map((b) => {
              const status = statusMeta(badgeState(b.status));
              return (
                <div
                  key={b.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand text-primary-foreground">
                      <BadgeTypeIcon type={b.type} />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {TYPE_LABEL[b.type] ?? b.type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {b.userName} · {b.skillName} · Issued {formatDate(b.issuedAt) ?? "—"}
                      </p>
                      {b.status === "revoked" && (
                        <p className="mt-1 text-xs text-red-600">
                          Revoked {formatDate(b.revokedAt) ?? ""}
                          {b.revokeReason ? ` — ${b.revokeReason}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${status.className}`}
                    >
                      <status.icon className="h-3 w-3" /> {status.label}
                    </span>
                    {b.status === "active" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => setRevokeTarget(b)}
                      >
                        <ShieldX className="h-4 w-4" /> Revoke
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => reissueMutation.mutate(b.id)}
                        disabled={reissueMutation.isPending}
                      >
                        <RefreshCcw className="h-4 w-4" /> Reissue
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="rounded-2xl border border-dashed border-border/70 bg-card p-10 text-center text-sm text-muted-foreground">
              No badges match these filters.
            </p>
          )}
        </div>
      </main>

      <Dialog open={Boolean(revokeTarget)} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke badge</DialogTitle>
            <DialogDescription>
              This hides the badge and the backing certificate from {revokeTarget?.userName}'s
              public profile. It can be reissued later.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRevoke}
              disabled={revokeMutation.isPending}
            >
              Revoke badge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject appeal</DialogTitle>
            <DialogDescription>
              Let {rejectTarget?.userName} know why the revocation stands.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason (optional)…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRejectAppeal}
              disabled={appealMutation.isPending}
            >
              Reject appeal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardChrome>
  );
}
