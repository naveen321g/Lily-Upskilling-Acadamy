import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Copy, Flag, Info, RotateCcw } from "lucide-react";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { getFraudSignals } from "@/lib/fraud.functions";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/fraud")({
  head: () => ({
    meta: [
      { title: "Fraud signals — LUA admin" },
      {
        name: "description",
        content: "Signals worth a manual look, computed from existing platform data.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FraudAdminPage,
});

function FraudAdminPage() {
  const fetchSignals = useServerFn(getFraudSignals);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-fraud"],
    queryFn: () => fetchSignals(),
  });

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <Breadcrumbs items={[{ label: "Admin", to: "/admin" }, { label: "Fraud" }]} />
        <PageHeader
          eyebrow="Admin"
          title="Fraud signals"
          subtitle="Patterns worth a manual look, computed from real platform data."
        />

        <div className="mt-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <Info className="h-4 w-4 shrink-0" />
          <p>
            This isn't a fraud-detection model — there's no document forensics, device
            fingerprinting or duplicate-account detection here. It surfaces what we can actually
            compute from existing records: candidates who submitted more than one certificate for
            the same skill, candidates who've repeatedly failed the same assessment, and attempts an
            admin manually flagged from the Assessments page. All three need a human to review
            before acting.
          </p>
        </div>

        {isLoading || !data ? (
          isError ? (
            <div className="mt-8">
              <ErrorState
                title="Couldn't load fraud signals"
                description="Please try again."
                onRetry={() => refetch()}
              />
            </div>
          ) : (
            <div className="mt-8 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <LoadingSkeleton key={i} className="h-20" />
              ))}
            </div>
          )
        ) : (
          <div className="mt-8 space-y-8">
            <Section
              icon={Copy}
              title="Duplicate certificate submissions"
              desc="More than one uploaded certificate from the same candidate for the same skill."
            >
              {data.duplicateCertificates.length ? (
                data.duplicateCertificates.map((s) => (
                  <Row key={`${s.userId}-${s.skillId}`}>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{s.userName}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.skillName} · {s.count} submissions
                      </p>
                    </div>
                    <Link
                      to="/admin/users/$id"
                      params={{ id: s.userId }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      View candidate
                    </Link>
                  </Row>
                ))
              ) : (
                <Empty />
              )}
            </Section>

            <Section
              icon={RotateCcw}
              title="Repeated failed attempts"
              desc="Three or more failed attempts on the same skill by the same candidate."
            >
              {data.repeatedFailures.length ? (
                data.repeatedFailures.map((s) => (
                  <Row key={`${s.userId}-${s.skillId}`}>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{s.userName}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.skillName} · {s.failedCount} failed attempts
                      </p>
                    </div>
                    <Link
                      to="/admin/users/$id"
                      params={{ id: s.userId }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      View candidate
                    </Link>
                  </Row>
                ))
              ) : (
                <Empty />
              )}
            </Section>

            <Section
              icon={Flag}
              title="Manually flagged attempts"
              desc="Attempts an admin marked as suspicious from the Assessments page."
            >
              {data.flaggedAttempts.length ? (
                data.flaggedAttempts.map((f) => (
                  <Row key={f.attemptId}>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{f.userName}</p>
                      <p className="text-xs text-muted-foreground">
                        {f.skillName} · Flagged {formatDate(f.flaggedAt) ?? "—"}
                        {f.reason ? ` — "${f.reason}"` : ""}
                      </p>
                    </div>
                    <Link
                      to="/admin/users/$id"
                      params={{ id: f.userId }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      View candidate
                    </Link>
                  </Row>
                ))
              ) : (
                <Empty />
              )}
            </Section>
          </div>
        )}
      </main>
    </DashboardChrome>
  );
}

function Section({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 text-primary" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card p-4 shadow-soft">
      {children}
    </div>
  );
}

function Empty() {
  return (
    <p className="flex items-center gap-2 rounded-xl border border-dashed border-border/70 p-4 text-xs text-muted-foreground">
      <AlertTriangle className="h-3.5 w-3.5" /> Nothing matching this signal right now.
    </p>
  );
}
