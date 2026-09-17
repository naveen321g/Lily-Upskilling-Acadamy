import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Award, BadgeCheck, Building2, ClipboardCheck } from "lucide-react";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { BackLink } from "@/components/shared/BackLink";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { JourneyStepper, type JourneyStep } from "@/components/shared/JourneyStepper";
import { VerificationBadges } from "@/components/skills/VerificationBadges";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { listMySkills } from "@/lib/skills.functions";
import { listAttempts } from "@/lib/assessment.functions";
import { listMyCertificates } from "@/lib/certificate.functions";
import { listMyBadges } from "@/lib/badges.functions";
import type { MySkillEntry } from "@/lib/skills-shared";
import { LEVEL_CONFIG, type AttemptSummary } from "@/lib/assessment-shared";
import type { CertificateSummary } from "@/lib/certificate-shared";
import type { MyBadge } from "@/lib/badges-shared";
import { skillIcon } from "@/lib/skill-icons";
import { formatDate } from "@/lib/format";
import {
  attemptState,
  certificateState,
  badgeState,
  skillCta,
  skillState,
  statusMeta,
} from "@/lib/status";

export const Route = createFileRoute("/_authenticated/skills/$id")({
  head: () => ({
    meta: [{ title: "Skill — LUA" }, { name: "robots", content: "noindex" }],
  }),
  component: SkillDetailPage,
});

function SkillDetailPage() {
  const { id } = Route.useParams();
  const fetchMySkills = useServerFn(listMySkills);
  const fetchAttempts = useServerFn(listAttempts);
  const fetchCertificates = useServerFn(listMyCertificates);
  const fetchBadges = useServerFn(listMyBadges);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-skills"],
    queryFn: () => fetchMySkills(),
  });
  const { data: attempts } = useQuery({
    queryKey: ["attempt-history"],
    queryFn: () => fetchAttempts(),
  });
  const { data: certificates } = useQuery({
    queryKey: ["my-certificates"],
    queryFn: () => fetchCertificates(),
  });
  const { data: badges } = useQuery({
    queryKey: ["my-badges"],
    queryFn: () => fetchBadges(),
  });

  const skill = data?.find((s) => s.id === id);
  const skillAttempts = (attempts ?? []).filter((a) => a.skillId === id);
  const skillCertificates = (certificates ?? []).filter((c) => c.skillId === id);
  const skillBadges = (badges ?? []).filter((b) => b.skillId === id);

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <Breadcrumbs
          items={[
            { label: "Dashboard", to: "/dashboard" },
            { label: "Skills", to: "/skills" },
            { label: skill?.name ?? "Skill" },
          ]}
        />
        <BackLink to="/skills" label="Back to Skills" />

        {isLoading ? (
          <div className="space-y-4">
            <LoadingSkeleton className="h-32" />
            <LoadingSkeleton className="h-48" />
          </div>
        ) : isError ? (
          <ErrorState
            title="Couldn't load this skill"
            description="Please try again."
            onRetry={() => refetch()}
          />
        ) : !skill ? (
          <p className="rounded-2xl border border-dashed border-border/70 bg-card p-10 text-center text-sm text-muted-foreground">
            Skill not found.
          </p>
        ) : (
          <SkillDetailBody
            skill={skill}
            attempts={skillAttempts}
            certificates={skillCertificates}
            badges={skillBadges}
          />
        )}
      </main>
    </DashboardChrome>
  );
}

function SkillDetailBody({
  skill,
  attempts,
  certificates,
  badges,
}: {
  skill: MySkillEntry;
  attempts: AttemptSummary[];
  certificates: CertificateSummary[];
  badges: MyBadge[];
}) {
  const Icon = skillIcon(skill.iconKey);
  const status = statusMeta(skillState(skill.status, skill.completion, skill.score));
  const cta = skillCta(skill);

  const hasAttempted = skill.completion > 0 || skill.score > 0 || skill.status !== "pending";
  const hasAi = skill.verifications.includes("ai");
  const hasCertificate = skill.verifications.includes("certificate");
  const hasBadge = skill.verifications.length > 0;

  const steps: JourneyStep[] = [
    { label: "Take Assessment", state: hasAttempted ? "done" : "current" },
    {
      label: "AI Verification",
      state: hasAi ? "done" : hasAttempted ? "current" : "upcoming",
    },
    {
      label: "Add Certificate",
      state: hasCertificate ? "done" : hasAi ? "current" : "upcoming",
    },
    { label: "Verified Badge", state: hasBadge ? "done" : "upcoming" },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-soft sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-soft">
              <Icon className="h-7 w-7" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">{skill.name}</h1>
              <p className="text-sm text-muted-foreground">
                {skill.category} · {skill.difficulty}
              </p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${status.className}`}
          >
            {status.label}
          </span>
        </div>

        <div className="mt-8">
          <JourneyStepper steps={steps} />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Completion" value={`${skill.completion}%`} />
          <Stat label="Score" value={`${skill.score}%`} />
          <Stat label="Issued" value={formatDate(skill.issuedAt) ?? "—"} />
        </div>

        {skill.verifications.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              Verifications
            </p>
            <VerificationBadges types={skill.verifications} size="md" />
          </div>
        )}

        <div className="mt-4">
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-default items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border/70">
                  <Building2 className="h-3 w-3" />
                  Institution Verified — coming soon
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-[220px] text-xs">
                LUA is building partnerships with training institutions to offer institution-backed
                verification. Not available yet.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="mt-8 border-t border-border/60 pt-6">
          <Button asChild className="bg-gradient-brand text-primary-foreground hover:opacity-95">
            <Link to={cta.to} params={cta.params}>
              {cta.label}
            </Link>
          </Button>
        </div>
      </div>

      <DetailSection icon={ClipboardCheck} title="Assessment history">
        {attempts.length ? (
          <div className="space-y-2">
            {attempts.map((a) => {
              const cfg = LEVEL_CONFIG[a.level];
              const st = statusMeta(attemptState(a.status, a.passed));
              const StIcon = st.icon;
              return (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {cfg.label}
                      <span
                        className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${st.className}`}
                      >
                        <StIcon className="h-3 w-3" /> {st.label}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Started {formatDate(a.startedAt) ?? "—"}
                      {a.score !== null && ` · Score ${a.score}%`}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/assessments/attempt/$id" params={{ id: a.id }}>
                      {a.status === "in_progress" ? "Resume" : "View result"}
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyRow>No assessment attempts for this skill yet.</EmptyRow>
        )}
      </DetailSection>

      <DetailSection icon={Award} title="Certificate">
        {certificates.length ? (
          <div className="space-y-2">
            {certificates.map((c) => {
              const st = statusMeta(certificateState(c.status));
              const StIcon = st.icon;
              return (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {c.title}
                      <span
                        className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${st.className}`}
                      >
                        <StIcon className="h-3 w-3" /> {st.label}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.source === "ai" ? "AI-issued" : "Uploaded"} · Issued{" "}
                      {formatDate(c.issuedAt) ?? "—"}
                    </p>
                    {c.reviewNotes && (
                      <p className="mt-1 text-xs italic text-muted-foreground">
                        "{c.reviewNotes}"
                      </p>
                    )}
                  </div>
                  {c.status === "approved" && (
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/certificates/$id" params={{ id: c.code }}>
                        View certificate
                      </Link>
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyRow>
            No certificate submitted for this skill yet.{" "}
            <Link to="/certificates" className="font-medium text-primary hover:underline">
              Upload one
            </Link>
            .
          </EmptyRow>
        )}
      </DetailSection>

      <DetailSection icon={BadgeCheck} title="Badges">
        {badges.length ? (
          <div className="space-y-2">
            {badges.map((b) => {
              const st = statusMeta(badgeState(b.status));
              const StIcon = st.icon;
              return (
                <div
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {b.type === "ai" ? "AI Skill Verified" : "Certification Verified"}
                      <span
                        className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${st.className}`}
                      >
                        <StIcon className="h-3 w-3" /> {st.label}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Issued {formatDate(b.issuedAt) ?? "—"}
                      {b.status === "revoked" &&
                        ` · Revoked ${formatDate(b.revokedAt) ?? ""}${b.revokeReason ? ` — "${b.revokeReason}"` : ""}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyRow>No badges earned for this skill yet.</EmptyRow>
        )}
      </DetailSection>
    </div>
  );
}

function DetailSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border/70 bg-card p-6 shadow-soft sm:p-8">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-semibold">{title}</h2>
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

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 inline-flex items-center gap-1 text-lg font-bold text-foreground">
        {Icon && <Icon className="h-4 w-4 text-primary" />}
        {value}
      </p>
    </div>
  );
}
