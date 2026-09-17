import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Award,
  BadgeCheck,
  ClipboardCheck,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  ShieldX,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { BackLink } from "@/components/shared/BackLink";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getUserDetail, setUserBanned } from "@/lib/users.functions";
import { resetAttempt } from "@/lib/admin.functions";
import { revokeBadge } from "@/lib/badges.functions";
import type { AdminUserBadge } from "@/lib/users-shared";
import { formatDate } from "@/lib/format";
import { attemptState, certificateState, skillState, statusMeta } from "@/lib/status";
import { isSkillFullyVerified } from "@/lib/skills-shared";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/users/$id")({
  head: () => ({
    meta: [{ title: "Candidate profile — LUA admin" }, { name: "robots", content: "noindex" }],
  }),
  component: UserDetailAdminPage,
});

function UserDetailAdminPage() {
  const { id } = Route.useParams();
  const fetchDetail = useServerFn(getUserDetail);
  const banMutationFn = useServerFn(setUserBanned);
  const resetMutationFn = useServerFn(resetAttempt);
  const revokeBadgeFn = useServerFn(revokeBadge);
  const queryClient = useQueryClient();
  const [revokeTarget, setRevokeTarget] = useState<AdminUserBadge | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  const {
    data: user,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["admin-user-detail", id],
    queryFn: () => fetchDetail({ data: { userId: id } }),
  });

  // Same rule as isFullyVerifiedBustler() (skills-shared.ts), applied to the
  // admin's own data shape — do not reimplement the per-skill check here,
  // only the "every current skill" aggregation.
  const fullyVerifiedBustler = Boolean(
    user?.skills.length && user.skills.every((s) => isSkillFullyVerified(s)),
  );

  const banMutation = useMutation({
    mutationFn: (banned: boolean) => banMutationFn({ data: { userId: id, banned } }),
    onSuccess: (_, banned) => {
      toast.success(banned ? "Account suspended." : "Account reinstated.");
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not update account."),
  });

  const resetMutation = useMutation({
    mutationFn: (attemptId: string) => resetMutationFn({ data: { attemptId } }),
    onSuccess: () => {
      toast.success("Attempt reset.");
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", id] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not reset attempt."),
  });

  const revokeMutation = useMutation({
    mutationFn: (args: { badgeId: string; reason?: string }) => revokeBadgeFn({ data: args }),
    onSuccess: () => {
      toast.success("Badge removed.");
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", id] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not remove badge."),
    onSettled: () => {
      setRevokeTarget(null);
      setRevokeReason("");
    },
  });

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <Breadcrumbs
          items={[
            { label: "Admin", to: "/admin" },
            { label: "Candidates", to: "/admin/users" },
            { label: user?.fullName ?? user?.email ?? "Candidate" },
          ]}
        />
        <BackLink to="/admin/users" label="Back to candidates" />

        {isLoading ? (
          <div className="space-y-4">
            <LoadingSkeleton className="h-24" />
            <LoadingSkeleton className="h-40" />
          </div>
        ) : isError ? (
          <ErrorState
            title="Couldn't load this candidate"
            description="Please try again."
            onRetry={() => refetch()}
          />
        ) : !user ? (
          <p className="rounded-2xl border border-dashed border-border/70 bg-card p-10 text-center text-sm text-muted-foreground">
            User not found.
          </p>
        ) : (
          <>
            <PageHeader
              eyebrow="Candidate profile"
              title={user.fullName ?? user.email}
              subtitle={user.email}
              actions={
                <Button
                  variant={user.bannedUntil ? "outline" : "destructive"}
                  onClick={() => banMutation.mutate(!user.bannedUntil)}
                  disabled={banMutation.isPending}
                >
                  <ShieldOff className="h-4 w-4" />
                  {user.bannedUntil ? "Reinstate account" : "Suspend account"}
                </Button>
              }
            />

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <Stat label="Verified skills" value={String(user.skillsVerified)} />
              <Stat label="Attempts" value={String(user.attemptsCount)} />
              <Stat label="Certificates" value={String(user.certificatesCount)} />
            </div>

            <div
              className={`mt-4 flex items-center gap-3 rounded-2xl border p-4 ${
                fullyVerifiedBustler
                  ? "border-primary/30 bg-primary/5"
                  : "border-border/70 bg-card"
              }`}
            >
              <ShieldCheck
                className={`h-5 w-5 shrink-0 ${fullyVerifiedBustler ? "text-primary" : "text-muted-foreground"}`}
              />
              <p className="text-sm">
                <span className="font-semibold text-foreground">Fully Verified Bustler: </span>
                <span className={fullyVerifiedBustler ? "text-primary" : "text-muted-foreground"}>
                  {fullyVerifiedBustler ? "Yes" : "No"}
                </span>
                {!fullyVerifiedBustler && user.skills.length > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    — every skill needs both AI and Certification verification active.
                  </span>
                )}
              </p>
            </div>

            <Section icon={BadgeCheck} title="Skills">
              {user.skills.length ? (
                <div className="space-y-2">
                  {user.skills.map((s) => {
                    const skillFullyVerified = isSkillFullyVerified(s);
                    return (
                      <div
                        key={s.skillId}
                        className="flex items-center justify-between rounded-xl border border-border/70 bg-card p-4"
                      >
                        <div>
                          <p className="text-sm font-semibold text-foreground">{s.skillName}</p>
                          <p className="text-xs text-muted-foreground">
                            {statusMeta(skillState(s.status, 0, s.score)).label} · Score {s.score}%
                          </p>
                          <p className="mt-1 text-xs">
                            AI Verification:{" "}
                            <span
                              className={
                                s.verifications.includes("ai")
                                  ? "text-primary"
                                  : "text-muted-foreground"
                              }
                            >
                              {s.verifications.includes("ai") ? "Verified" : "Not verified"}
                            </span>
                            {" · "}
                            Certification Verification:{" "}
                            <span
                              className={
                                s.verifications.includes("certificate")
                                  ? "text-primary"
                                  : "text-muted-foreground"
                              }
                            >
                              {s.verifications.includes("certificate") ? "Verified" : "Not verified"}
                            </span>
                          </p>
                          <p
                            className={`mt-1 text-xs font-medium ${skillFullyVerified ? "text-primary" : "text-amber-600"}`}
                          >
                            Skill Status:{" "}
                            {skillFullyVerified ? "Fully Verified" : "Not Fully Verified"}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          {s.verifications.map((v) => (
                            <span
                              key={v}
                              className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                            >
                              {v}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyRow>No skills yet.</EmptyRow>
              )}
            </Section>

            <Section icon={ClipboardCheck} title="Assessment history">
              {user.attempts.length ? (
                <div className="space-y-2">
                  {user.attempts.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-xl border border-border/70 bg-card p-4"
                    >
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {a.skillName} · {a.level}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {statusMeta(attemptState(a.status, a.passed)).label} ·{" "}
                          {formatDate(a.startedAt) ?? "—"}
                          {a.score !== null && ` · ${a.score}%`}
                        </p>
                      </div>
                      {a.status === "in_progress" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resetMutation.mutate(a.id)}
                          disabled={resetMutation.isPending}
                        >
                          <RotateCcw className="h-4 w-4" /> Reset
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyRow>No assessment attempts yet.</EmptyRow>
              )}
            </Section>

            <Section icon={Sparkles} title="Badges">
              {user.badges.length ? (
                <div className="space-y-2">
                  {user.badges.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between rounded-xl border border-border/70 bg-card p-4"
                    >
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {b.type === "ai" ? "AI Skill Verified" : "Certification Verified"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {b.skillName} · Issued {formatDate(b.issuedAt) ?? "—"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => setRevokeTarget(b)}
                      >
                        <ShieldX className="h-4 w-4" /> Remove
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyRow>No active badges.</EmptyRow>
              )}
            </Section>

            <Section icon={Award} title="Certificates">
              {user.certificates.length ? (
                <div className="space-y-2">
                  {user.certificates.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-xl border border-border/70 bg-card p-4"
                    >
                      <div>
                        <p className="text-sm font-semibold text-foreground">{c.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.source === "ai" ? "AI-issued" : "Uploaded"} ·{" "}
                          {statusMeta(certificateState(c.status)).label} ·{" "}
                          {formatDate(c.issuedAt) ?? "—"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyRow>No certificates yet.</EmptyRow>
              )}
            </Section>
          </>
        )}
      </main>

      <Dialog open={Boolean(revokeTarget)} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove badge</DialogTitle>
            <DialogDescription>
              This hides the {revokeTarget?.skillName} badge and its backing certificate from this
              candidate's public profile. It can be reissued later from Admin → Badges.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
            placeholder="Reason (optional)…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={revokeMutation.isPending}
              onClick={() =>
                revokeTarget &&
                revokeMutation.mutate({
                  badgeId: revokeTarget.id,
                  reason: revokeReason.trim() || undefined,
                })
              }
            >
              Remove badge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardChrome>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
      <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border/70 bg-card p-6 text-center text-xs text-muted-foreground">
      {children}
    </p>
  );
}
