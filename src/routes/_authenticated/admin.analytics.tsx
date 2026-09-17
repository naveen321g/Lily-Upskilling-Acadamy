import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Award, BarChart3, Gem, Sparkles, TrendingUp, Trophy, Users } from "lucide-react";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { getAnalyticsSummary } from "@/lib/analytics.functions";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — LUA admin" },
      {
        name: "description",
        content:
          "Platform-wide analytics: growth, pass rates, popular skills and badge distribution.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AnalyticsAdminPage,
});

function AnalyticsAdminPage() {
  const fetchSummary = useServerFn(getAnalyticsSummary);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => fetchSummary(),
  });

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <Breadcrumbs items={[{ label: "Admin", to: "/admin" }, { label: "Analytics" }]} />
        <PageHeader eyebrow="Admin" title="Analytics" subtitle="Platform health at a glance." />

        {isLoading || !data ? (
          isError ? (
            <div className="mt-8">
              <ErrorState
                title="Couldn't load analytics"
                description="Please try again."
                onRetry={() => refetch()}
              />
            </div>
          ) : (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <LoadingSkeleton key={i} className="h-28" />
              ))}
            </div>
          )
        ) : (
          <div className="mt-8 space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Tile icon={Users} label="Total users" value={String(data.totalUsers)} />
              <Tile
                icon={BarChart3}
                label="Assessments evaluated"
                value={String(data.totalAssessments)}
              />
              <Tile icon={Trophy} label="Pass rate" value={`${data.passRate}%`} />
              <Tile
                icon={Award}
                label="Certificates approved"
                value={String(data.certificates.approved)}
              />
            </div>

            <Card title="Users, last 6 months" icon={TrendingUp}>
              <BarList items={data.userGrowth.map((p) => ({ label: p.label, value: p.value }))} />
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Popular skills" icon={Sparkles}>
                {data.popularSkills.length ? (
                  <BarList
                    items={data.popularSkills.map((s) => ({
                      label: s.skillName,
                      value: s.attempts,
                    }))}
                    suffix=" attempts"
                  />
                ) : (
                  <Empty />
                )}
              </Card>
              <Card title="Average score by category" icon={BarChart3}>
                {data.categoryScores.length ? (
                  <BarList
                    items={data.categoryScores.map((c) => ({
                      label: c.category,
                      value: c.avgScore,
                    }))}
                    max={100}
                    suffix="%"
                  />
                ) : (
                  <Empty />
                )}
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Certificates" icon={Award}>
                <BarList
                  items={[
                    { label: "Approved", value: data.certificates.approved },
                    { label: "Pending", value: data.certificates.pending },
                    { label: "Rejected", value: data.certificates.rejected },
                  ]}
                />
              </Card>
              <Card title="Badge distribution" icon={Gem}>
                <BarList
                  items={[
                    { label: "AI Skill Verified", value: data.badges.aiVerified },
                    { label: "Certification Verified", value: data.badges.certificateVerified },
                    { label: "Fully verified skills (both)", value: data.badges.fullyVerified },
                    { label: "Fully Verified Bustlers", value: data.fullyVerifiedBustlers },
                  ]}
                />
              </Card>
            </div>
          </div>
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
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
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

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function BarList({
  items,
  max,
  suffix = "",
}: {
  items: { label: string; value: number }[];
  max?: number;
  suffix?: string;
}) {
  const cap = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-semibold text-foreground">
              {item.value}
              {suffix}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-brand"
              style={{ width: `${Math.min(100, (item.value / cap) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty() {
  return <p className="text-xs text-muted-foreground">Not enough data yet.</p>;
}
