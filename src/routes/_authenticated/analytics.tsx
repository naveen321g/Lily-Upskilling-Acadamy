import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Award, BadgeCheck, Gem, LineChart, Target } from "lucide-react";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { listMySkills } from "@/lib/skills.functions";
import { listAttempts } from "@/lib/assessment.functions";
import { listMyCertificates } from "@/lib/certificate.functions";
import { listMyBadges } from "@/lib/badges.functions";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — LUA" },
      {
        name: "description",
        content: "Your verification progress, scores and badge collection at a glance.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const fetchSkills = useServerFn(listMySkills);
  const fetchAttempts = useServerFn(listAttempts);
  const fetchCertificates = useServerFn(listMyCertificates);
  const fetchBadges = useServerFn(listMyBadges);

  const {
    data: skills,
    isLoading: skillsLoading,
    isError: skillsErr,
    refetch: refetchSkills,
  } = useQuery({
    queryKey: ["my-skills"],
    queryFn: () => fetchSkills(),
  });
  const {
    data: attempts,
    isLoading: attemptsLoading,
    isError: attemptsErr,
    refetch: refetchAttempts,
  } = useQuery({
    queryKey: ["attempt-history"],
    queryFn: () => fetchAttempts(),
  });
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

  const isLoading = skillsLoading || attemptsLoading || certsLoading || badgesLoading;
  const isError = skillsErr || attemptsErr || certsErr || badgesErr;
  function retryAll() {
    refetchSkills();
    refetchAttempts();
    refetchCerts();
    refetchBadges();
  }

  const verifiedSkills = (skills ?? []).filter((s) => s.status === "verified").length;
  const evaluated = (attempts ?? []).filter((a) => a.status === "evaluated" && a.score !== null);
  const avgScore = evaluated.length
    ? Math.round(evaluated.reduce((sum, a) => sum + (a.score ?? 0), 0) / evaluated.length)
    : 0;
  const activeBadges = (badges ?? []).filter((b) => b.status === "active");

  // Learning progress: score of the last 8 evaluated attempts, oldest first.
  const trend = useMemo(
    () =>
      [...evaluated]
        .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
        .slice(-8),
    [evaluated],
  );

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <Breadcrumbs items={[{ label: "Dashboard", to: "/dashboard" }, { label: "Analytics" }]} />
        <PageHeader
          eyebrow="Your progress"
          title="Analytics"
          subtitle="How your verification journey is going, at a glance."
        />

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <LoadingSkeleton key={i} className="h-28" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Couldn't load your analytics"
            description="Please try again."
            onRetry={retryAll}
          />
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Tile icon={Target} label="Skills verified" value={String(verifiedSkills)} />
              <Tile icon={LineChart} label="Average score" value={`${avgScore}%`} />
              <Tile icon={Award} label="Certificates" value={String((certificates ?? []).length)} />
              <Tile icon={Gem} label="Badges earned" value={String(activeBadges.length)} />
            </section>

            <section>
              <h2 className="mb-4 font-display text-lg font-semibold tracking-tight">
                Learning progress
              </h2>
              {trend.length ? (
                <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-soft">
                  <div className="flex items-end gap-3" style={{ height: 140 }}>
                    {trend.map((a) => (
                      <div key={a.id} className="flex flex-1 flex-col items-center gap-2">
                        <div className="flex h-full w-full items-end">
                          <div
                            className="w-full rounded-t-lg bg-gradient-brand"
                            style={{ height: `${Math.max(a.score ?? 0, 4)}%` }}
                            title={`${a.skillName}: ${a.score}%`}
                          />
                        </div>
                        <span className="text-[10px] font-medium text-muted-foreground">
                          {a.score}%
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Your last {trend.length} evaluated assessment{trend.length === 1 ? "" : "s"},
                    oldest to most recent.
                  </p>
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-border/70 bg-card p-8 text-center text-sm text-muted-foreground">
                  Take an assessment to start seeing your score trend here.
                </p>
              )}
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold tracking-tight">
                  Badge collection
                </h2>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/badges">View all badges →</Link>
                </Button>
              </div>
              {activeBadges.length ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {activeBadges.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-soft"
                    >
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-brand text-primary-foreground">
                        <BadgeCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {b.type === "ai" ? "AI Skill Verified" : "Certification Verified"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {b.skillName} · {formatDate(b.issuedAt) ?? "—"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-border/70 bg-card p-8 text-center text-sm text-muted-foreground">
                  No badges yet — verify a skill to earn your first one.
                </p>
              )}
            </section>
          </>
        )}
      </main>
    </DashboardChrome>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand text-primary-foreground">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
