import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Award,
  BadgeCheck,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Download,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { listMyCertificates } from "@/lib/certificate.functions";
import { listMySkills } from "@/lib/skills.functions";
import { isFullyVerifiedBustler } from "@/lib/skills-shared";
import { listAttempts } from "@/lib/assessment.functions";
import { computeNextAction } from "@/lib/next-action";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — LUA" }, { name: "robots", content: "noindex" }],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = Route.useRouteContext();
  const [name, setName] = useState<string>(user.email ?? "there");

  const fetchCertificates = useServerFn(listMyCertificates);
  const fetchSkills = useServerFn(listMySkills);
  const fetchAttempts = useServerFn(listAttempts);

  const {
    data: certificates,
    isLoading: certsLoading,
    isError: certsError,
    refetch: refetchCerts,
  } = useQuery({
    queryKey: ["my-certificates"],
    queryFn: () => fetchCertificates(),
  });
  const {
    data: skills,
    isLoading: skillsLoading,
    isError: skillsError,
    refetch: refetchSkills,
  } = useQuery({
    queryKey: ["my-skills"],
    queryFn: () => fetchSkills(),
  });
  const {
    data: attempts,
    isLoading: attemptsLoading,
    isError: attemptsError,
    refetch: refetchAttempts,
  } = useQuery({
    queryKey: ["attempt-history"],
    queryFn: () => fetchAttempts(),
  });

  const pageLoading = certsLoading || skillsLoading || attemptsLoading;
  const pageError = certsError || skillsError || attemptsError;
  function retryAll() {
    refetchCerts();
    refetchSkills();
    refetchAttempts();
  }

  useEffect(() => {
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.full_name) setName(data.full_name);
      });
  }, [user.id]);

  const loaded = certificates !== undefined && skills !== undefined && attempts !== undefined;
  const recentCertificates = (certificates ?? [])
    .filter((c) => c.status === "approved")
    .slice(0, 2);
  const verifiedSkills = (skills ?? []).filter((s) => s.status === "verified");
  const fullyVerified = isFullyVerifiedBustler(skills ?? []);

  const nextAction = loaded
    ? computeNextAction({
        skills: skills ?? [],
        attempts: attempts ?? [],
        certificates: certificates ?? [],
      })
    : null;

  const gettingStarted = [
    { label: "Browse skills and start an assessment", done: (attempts?.length ?? 0) > 0 },
    { label: "Pass an assessment", done: verifiedSkills.length > 0 },
    { label: "Add a certificate for extra proof", done: (certificates?.length ?? 0) > 0 },
    {
      label: "Earn your verification badge",
      done: (skills ?? []).some((s) => s.verifications.length > 0),
    },
  ];
  const showGettingStarted = loaded && verifiedSkills.length === 0;

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        {/* Welcome */}
        <div>
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{name}</h1>
            {fullyVerified && (
              <Link
                to="/badges"
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Fully Verified Bustler
              </Link>
            )}
          </div>
        </div>

        {pageLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <LoadingSkeleton key={i} className="h-28" />
            ))}
          </div>
        ) : pageError ? (
          <ErrorState
            title="Couldn't load your dashboard"
            description="We couldn't load your assessments, skills or certificates. Please try again."
            onRetry={retryAll}
          />
        ) : (
          <>
            {/* Next Action */}
            {nextAction && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border border-border/70 bg-gradient-brand p-8 text-primary-foreground shadow-elevated"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">
                  Next Action
                </p>
                <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
                  {nextAction.title}
                </h2>
                <p className="mt-2 max-w-xl text-sm text-primary-foreground/85">
                  {nextAction.description}
                </p>
                {nextAction.etaMinutes && (
                  <p className="mt-3 text-xs text-primary-foreground/70">
                    Estimated time: {nextAction.etaMinutes} min
                  </p>
                )}
                <Button className="mt-5 bg-background text-primary hover:bg-background/90" asChild>
                  <Link to={nextAction.ctaTo} params={nextAction.ctaParams}>
                    {nextAction.ctaLabel} →
                  </Link>
                </Button>
              </motion.div>
            )}

            {/* Quick tiles */}
            <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Tile
                icon={ClipboardCheck}
                title="Assessments"
                value={String(attempts?.length ?? 0)}
              />
              <Tile icon={Award} title="Certificates" value={String(certificates?.length ?? 0)} />
              <Tile icon={Target} title="Skills verified" value={String(verifiedSkills.length)} />
            </section>

            {/* Getting started */}
            {showGettingStarted && (
              <section className="rounded-3xl border border-border/70 bg-card p-8 shadow-soft">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-lg font-semibold">Welcome to LUA</h2>
                </div>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  Let's get your first skill verified. Here's the path from here.
                </p>
                <ol className="mt-5 grid gap-3 sm:grid-cols-2">
                  {gettingStarted.map((step, i) => (
                    <li
                      key={step.label}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${
                        step.done
                          ? "border-primary/30 bg-primary/5"
                          : "border-border/60 bg-background"
                      }`}
                    >
                      {step.done ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                      ) : (
                        <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                      )}
                      <span className={step.done ? "text-foreground" : "text-muted-foreground"}>
                        {i + 1}. {step.label}
                      </span>
                    </li>
                  ))}
                </ol>
                <Button
                  className="mt-5 bg-gradient-brand text-primary-foreground hover:opacity-95"
                  asChild
                >
                  <Link to="/assessments">Get Started →</Link>
                </Button>
              </section>
            )}

            {/* Recent certificates */}
            <Section
              icon={Award}
              title="Recent certificates"
              desc="Shareable, tamper-evident credentials backed by LUA verification."
              action={
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/certificates">All certificates →</Link>
                </Button>
              }
            >
              {recentCertificates.length ? (
                <div className="grid gap-5 md:grid-cols-2">
                  {recentCertificates.map((c) => (
                    <div
                      key={c.id}
                      className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-6 shadow-soft"
                    >
                      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-brand opacity-10 blur-2xl transition-opacity group-hover:opacity-20" />
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                            <BadgeCheck className="h-3 w-3" /> Verified
                          </span>
                          <h3 className="mt-3 text-lg font-semibold text-foreground">{c.title}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Issued {formatDate(c.issuedAt) ?? "—"} · ID {c.code}
                          </p>
                        </div>
                        <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-brand text-primary-foreground shadow-soft">
                          <Award className="h-5 w-5" />
                        </div>
                      </div>
                      <div className="mt-5 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Score</p>
                          <p className="text-2xl font-bold tracking-tight">{c.score}%</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" asChild>
                            <Link to="/verify/$id" params={{ id: c.code }}>
                              <ShieldCheck className="h-4 w-4" /> Verify with employer
                            </Link>
                          </Button>
                          <Button size="sm" asChild>
                            <Link to="/certificates/$id" params={{ id: c.code }}>
                              <Download className="h-4 w-4" /> View & download
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-border/70 bg-card p-8 text-center text-sm text-muted-foreground">
                  No certificates yet. Pass an expert assessment or upload one for review.
                </p>
              )}
            </Section>
          </>
        )}
      </main>
    </DashboardChrome>
  );
}

function Section({
  icon: Icon,
  title,
  desc,
  action,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand text-primary-foreground shadow-soft">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
            {desc && <p className="text-sm text-muted-foreground">{desc}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Tile({
  icon: Icon,
  title,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand text-primary-foreground">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
