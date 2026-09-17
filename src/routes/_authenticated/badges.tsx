import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Award, Building2, Gavel, ShieldCheck, ShieldX, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/skills/EmptyState";
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
import { appealBadge, listMyBadgeAppeals, listMyBadges } from "@/lib/badges.functions";
import type { MyBadge } from "@/lib/badges-shared";
import { listMySkills } from "@/lib/skills.functions";
import { isFullyVerifiedBustler } from "@/lib/skills-shared";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/badges")({
  head: () => ({
    meta: [
      { title: "My Badges — LUA" },
      {
        name: "description",
        content: "Every AI Skill Verified and Certification Verified badge you've earned.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BadgesPage,
});

const TYPE_LABEL: Record<string, string> = {
  ai: "AI Skill Verified",
  certificate: "Certification Verified",
  institution: "Institution Verified",
};

function BadgeTypeIcon({ type }: { type: string }) {
  if (type === "ai") return <Sparkles className="h-5 w-5" />;
  if (type === "institution") return <Building2 className="h-5 w-5" />;
  return <Award className="h-5 w-5" />;
}

function BadgesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchBadges = useServerFn(listMyBadges);
  const fetchSkills = useServerFn(listMySkills);
  const fetchAppeals = useServerFn(listMyBadgeAppeals);
  const submitAppeal = useServerFn(appealBadge);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-badges"],
    queryFn: () => fetchBadges(),
  });
  const { data: skills } = useQuery({ queryKey: ["my-skills"], queryFn: () => fetchSkills() });
  const { data: appeals } = useQuery({
    queryKey: ["my-badge-appeals"],
    queryFn: () => fetchAppeals(),
  });
  const active = (data ?? []).filter((b) => b.status === "active");
  const revoked = (data ?? []).filter((b) => b.status === "revoked");
  const fullyVerified = isFullyVerifiedBustler(skills ?? []);

  const [appealTarget, setAppealTarget] = useState<MyBadge | null>(null);
  const [appealReason, setAppealReason] = useState("");

  const appealMutation = useMutation({
    mutationFn: (args: { badgeId: string; reason: string }) => submitAppeal({ data: args }),
    onSuccess: () => {
      toast.success("Appeal submitted for review.");
      queryClient.invalidateQueries({ queryKey: ["my-badge-appeals"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not submit appeal."),
    onSettled: () => {
      setAppealTarget(null);
      setAppealReason("");
    },
  });

  function latestAppealFor(badgeId: string) {
    return (appeals ?? []).find((a) => a.badgeId === badgeId);
  }

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <PageHeader
          eyebrow="Skill Verification"
          title="My Badges"
          subtitle="Every verification you've earned across your skill portfolio."
        />

        {fullyVerified && (
          <div className="mt-8 flex items-center gap-4 rounded-2xl border border-primary/30 bg-gradient-brand p-6 text-primary-foreground shadow-elevated">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-background/15">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="font-display text-lg font-bold">Fully Verified Bustler</p>
              <p className="text-sm text-primary-foreground/85">
                Every skill on your profile has completed verification. This is the highest trust
                signal customers see on your Bustler profile.
              </p>
            </div>
          </div>
        )}

        <div className="mt-8">
          {isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <LoadingSkeleton key={i} className="h-32" />
              ))}
            </div>
          ) : isError ? (
            <ErrorState
              title="Couldn't load your badges"
              description="Please try again."
              onRetry={() => refetch()}
            />
          ) : active.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((b) => (
                <div
                  key={b.id}
                  className="rounded-2xl border border-border/70 bg-card p-6 shadow-soft"
                >
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-brand text-primary-foreground shadow-soft">
                    <BadgeTypeIcon type={b.type} />
                  </div>
                  <p className="mt-4 font-semibold text-foreground">
                    {TYPE_LABEL[b.type] ?? b.type}
                  </p>
                  <p className="text-xs text-muted-foreground">{b.skillName}</p>
                  <p className="mt-3 text-[11px] uppercase tracking-wide text-muted-foreground">
                    Issued {formatDate(b.issuedAt) ?? "—"}
                  </p>
                  <Button size="sm" variant="outline" className="mt-4" asChild>
                    <Link to="/skills/$id" params={{ id: b.skillId }}>
                      View skill
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No badges yet"
              description="Pass an expert assessment or get an uploaded certificate approved to earn your first badge."
              actionLabel="Explore skills"
              onAction={() => navigate({ to: "/assessments" })}
            />
          )}
        </div>

        {revoked.length > 0 && (
          <div className="mt-12">
            <h2 className="mb-4 font-display text-lg font-semibold tracking-tight">
              Revoked badges
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {revoked.map((b) => {
                const appeal = latestAppealFor(b.id);
                return (
                  <div
                    key={b.id}
                    className="rounded-2xl border border-red-200 bg-red-50/40 p-6 shadow-soft dark:border-red-900/40 dark:bg-red-950/10"
                  >
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                      <ShieldX className="h-5 w-5" />
                    </div>
                    <p className="mt-4 font-semibold text-foreground">
                      {TYPE_LABEL[b.type] ?? b.type}
                    </p>
                    <p className="text-xs text-muted-foreground">{b.skillName}</p>
                    <p className="mt-2 text-xs text-red-700 dark:text-red-400">
                      Revoked {formatDate(b.revokedAt) ?? ""}
                      {b.revokeReason ? ` — ${b.revokeReason}` : ""}
                    </p>

                    {appeal ? (
                      <p className="mt-4 text-xs font-medium text-muted-foreground">
                        {appeal.status === "pending" && "Appeal submitted — awaiting review."}
                        {appeal.status === "approved" && "Appeal approved — badge reinstated."}
                        {appeal.status === "rejected" &&
                          `Appeal rejected${appeal.adminNotes ? `: "${appeal.adminNotes}"` : "."}`}
                      </p>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-4 gap-1"
                        onClick={() => setAppealTarget(b)}
                      >
                        <Gavel className="h-4 w-4" /> Appeal this decision
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <Dialog open={Boolean(appealTarget)} onOpenChange={(open) => !open && setAppealTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appeal {appealTarget?.skillName} badge revocation</DialogTitle>
            <DialogDescription>
              Explain why you believe this badge should be reinstated. An admin will review your
              appeal and either restore the badge or explain why the revocation stands.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={appealReason}
            onChange={(e) => setAppealReason(e.target.value)}
            placeholder="Why should this badge be reinstated? (at least 10 characters)"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAppealTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={appealMutation.isPending || appealReason.trim().length < 10}
              onClick={() =>
                appealTarget &&
                appealMutation.mutate({ badgeId: appealTarget.id, reason: appealReason.trim() })
              }
            >
              Submit appeal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardChrome>
  );
}
