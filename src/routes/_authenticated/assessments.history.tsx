import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { BadgeCheck, Clock, XCircle } from "lucide-react";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LEVEL_CONFIG } from "@/lib/assessment-shared";
import { listAttempts } from "@/lib/assessment.functions";

export const Route = createFileRoute("/_authenticated/assessments/history")({
  head: () => ({
    meta: [
      { title: "Assessment history — LUA" },
      {
        name: "description",
        content: "Review every skill assessment you have taken, your scores, and AI evaluations.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const fetchAttempts = useServerFn(listAttempts);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["attempt-history"],
    queryFn: () => fetchAttempts(),
  });

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { label: "Dashboard", to: "/dashboard" },
            { label: "Assessments", to: "/assessments" },
            { label: "History" },
          ]}
        />
        <PageHeader
          eyebrow="Track record"
          title="Assessment history"
          subtitle="Every attempt you have started, with scores and AI evaluations."
          actions={
            <Button asChild>
              <Link to="/assessments">Take an assessment</Link>
            </Button>
          }
        />

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <LoadingSkeleton key={i} className="h-24" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Couldn't load your assessment history"
            description="Please try again."
            onRetry={() => refetch()}
          />
        ) : (data ?? []).length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card p-12 text-center shadow-sm">
            <h2 className="font-display text-xl font-semibold">No attempts yet</h2>
            <p className="mt-2 text-muted-foreground">
              Start your first AI-evaluated assessment to build your verified skill record.
            </p>
            <Button className="mt-6" asChild>
              <Link to="/assessments">Browse skills</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {(data ?? []).map((a, i) => {
              const cfg = LEVEL_CONFIG[a.level];
              const inProgress = a.status === "in_progress";
              return (
                <motion.li
                  key={a.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-sm"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-lg font-semibold">{a.skillName}</h2>
                      <Badge variant="outline">{cfg.label}</Badge>
                      {inProgress ? (
                        <Badge className="gap-1 bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 dark:text-amber-300">
                          <Clock className="h-3.5 w-3.5" /> In progress
                        </Badge>
                      ) : a.passed ? (
                        <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300">
                          <BadgeCheck className="h-3.5 w-3.5" /> Passed
                        </Badge>
                      ) : (
                        <Badge className="gap-1 bg-destructive/10 text-destructive hover:bg-destructive/10">
                          <XCircle className="h-3.5 w-3.5" /> Not passed
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Started {new Date(a.startedAt).toLocaleString()}
                      {a.submittedAt && ` · submitted ${new Date(a.submittedAt).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-display text-2xl font-bold text-primary">
                        {a.score === null ? "—" : `${a.score}%`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.correctCount ?? 0}/{a.totalQuestions} correct
                      </p>
                    </div>
                    <Button variant={inProgress ? "default" : "outline"} asChild>
                      <Link to="/assessments/attempt/$id" params={{ id: a.id }}>
                        {inProgress ? "Resume" : "View result"}
                      </Link>
                    </Button>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        )}
      </main>
    </DashboardChrome>
  );
}
