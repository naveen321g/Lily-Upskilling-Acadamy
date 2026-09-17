import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock,
  Loader2,
  Save,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { BackLink } from "@/components/shared/BackLink";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LEVEL_CONFIG, type AttemptAnswers } from "@/lib/assessment-shared";
import { getAttempt, saveAnswers, submitAttempt } from "@/lib/assessment.functions";

export const Route = createFileRoute("/_authenticated/assessments/attempt/$id")({
  head: () => ({
    meta: [
      { title: "Assessment in progress — LUA" },
      {
        name: "description",
        content: "Answer your timed, AI-evaluated skill assessment at Lily Upskilling Academy.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AttemptRunner,
});

function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function AttemptRunner() {
  const { id } = Route.useParams();
  const fetchAttempt = useServerFn(getAttempt);
  const persist = useServerFn(saveAnswers);
  const finish = useServerFn(submitAttempt);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["attempt", id],
    queryFn: () => fetchAttempt({ data: { attemptId: id } }),
  });

  if (isError) {
    return (
      <DashboardChrome>
        <main className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
          <ErrorState
            title="Couldn't load this assessment"
            description="Please try again."
            onRetry={() => refetch()}
          />
        </main>
      </DashboardChrome>
    );
  }

  if (isLoading || !data) {
    return (
      <DashboardChrome>
        <main className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
          <LoadingSkeleton className="h-24" />
          <LoadingSkeleton className="h-80" />
        </main>
      </DashboardChrome>
    );
  }

  if (data.status !== "in_progress") {
    return <AttemptResult attempt={data} />;
  }

  return (
    <RunnerBody
      key={data.id}
      attempt={data}
      persist={persist}
      finish={finish}
      onFinished={() => refetch()}
    />
  );
}

type Attempt = Awaited<ReturnType<typeof getAttempt>>;

function RunnerBody({
  attempt,
  persist,
  finish,
  onFinished,
}: {
  attempt: Attempt;
  persist: (args: { data: { attemptId: string; answers: AttemptAnswers } }) => Promise<unknown>;
  finish: (args: { data: { attemptId: string; answers?: AttemptAnswers } }) => Promise<unknown>;
  onFinished: () => void;
}) {
  const cfg = LEVEL_CONFIG[attempt.level];
  const [answers, setAnswers] = useState<AttemptAnswers>(attempt.answers ?? {});
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(
    () => new Date(attempt.deadlineAt).getTime() - Date.now(),
  );
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const dirty = useRef(false);
  const submittedRef = useRef(false);

  const question = attempt.questions[index];
  const answeredCount = Object.keys(answers).length;

  const submit = useCallback(
    async (auto = false) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      try {
        await finish({ data: { attemptId: attempt.id, answers } });
        if (auto) toast.info("Time is up — your assessment was submitted automatically.");
        onFinished();
      } catch (error) {
        submittedRef.current = false;
        toast.error(error instanceof Error ? error.message : "Could not submit the assessment.");
      } finally {
        setSubmitting(false);
      }
    },
    [answers, attempt.id, finish, onFinished],
  );

  // Countdown timer.
  useEffect(() => {
    const t = setInterval(() => {
      const left = new Date(attempt.deadlineAt).getTime() - Date.now();
      setRemaining(left);
      if (left <= 0) void submit(true);
    }, 1000);
    return () => clearInterval(t);
  }, [attempt.deadlineAt, submit]);

  // Auto-save every 15 seconds when there are unsaved changes.
  useEffect(() => {
    const t = setInterval(async () => {
      if (!dirty.current || submittedRef.current) return;
      dirty.current = false;
      try {
        await persist({ data: { attemptId: attempt.id, answers } });
        setSavedAt(new Date());
      } catch {
        dirty.current = true;
      }
    }, 15000);
    return () => clearInterval(t);
  }, [answers, attempt.id, persist]);

  function choose(optionIndex: number) {
    setAnswers((prev) => ({ ...prev, [question.id]: optionIndex }));
    dirty.current = true;
  }

  async function saveNow() {
    try {
      await persist({ data: { attemptId: attempt.id, answers } });
      dirty.current = false;
      setSavedAt(new Date());
      toast.success("Progress saved.");
    } catch {
      toast.error("Could not save your progress.");
    }
  }

  const urgent = remaining <= 60_000;

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { label: "Dashboard", to: "/dashboard" },
            { label: "Assessments", to: "/assessments" },
            { label: attempt.skillName, to: "/assessments" },
            { label: "Attempt" },
          ]}
        />
        <BackLink to="/assessments" label="Back to Assessments" />
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {cfg.label} assessment
            </p>
            <h1 className="font-display text-2xl font-bold">{attempt.skillName}</h1>
            <p className="text-sm text-muted-foreground">
              {answeredCount} of {attempt.questions.length} answered · {cfg.passMark}% to pass
            </p>
          </div>
          <div
            className={`flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-lg font-semibold ${
              urgent ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
            }`}
            role="timer"
            aria-live="off"
          >
            <Clock className="h-5 w-5" /> {formatClock(remaining)}
          </div>
        </div>

        <Progress value={(answeredCount / attempt.questions.length) * 100} className="h-2" />

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Question navigation">
          {attempt.questions.map((q, i) => (
            <button
              key={q.id}
              role="tab"
              aria-selected={i === index}
              aria-label={`Question ${i + 1}${answers[q.id] !== undefined ? ", answered" : ""}`}
              onClick={() => setIndex(i)}
              className={`h-9 w-9 rounded-lg border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                i === index
                  ? "border-primary bg-primary text-primary-foreground"
                  : answers[q.id] !== undefined
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <motion.section
          key={question.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm"
        >
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Question {index + 1} of {attempt.questions.length}
          </p>
          <h2 className="mt-2 text-lg font-semibold leading-snug">{question.prompt}</h2>
          <div className="mt-5 space-y-3">
            {question.options.map((option, i) => {
              const selected = answers[question.id] === i;
              return (
                <button
                  key={i}
                  onClick={() => choose(i)}
                  aria-pressed={selected}
                  className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    selected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border"
                    }`}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="text-sm">{option}</span>
                </button>
              );
            })}
          </div>
        </motion.section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
            >
              <ArrowLeft className="h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setIndex((i) => Math.min(attempt.questions.length - 1, i + 1))}
              disabled={index === attempt.questions.length - 1}
            >
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : "Auto-saves every 15s"}
            </span>
            <Button variant="ghost" onClick={saveNow}>
              <Save className="h-4 w-4" /> Save
            </Button>
            <Button onClick={() => submit(false)} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Submit assessment
            </Button>
          </div>
        </div>

        {answeredCount < attempt.questions.length && (
          <p className="flex items-center gap-2 text-sm text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            {attempt.questions.length - answeredCount} question(s) still unanswered.
          </p>
        )}
      </main>
    </DashboardChrome>
  );
}

function AttemptResult({ attempt }: { attempt: Attempt }) {
  const cfg = LEVEL_CONFIG[attempt.level];
  const passed = Boolean(attempt.passed);
  const feedback = attempt.aiFeedback;
  const navigate = useNavigate();

  const breakdown = useMemo(() => feedback?.breakdown ?? [], [feedback]);

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { label: "Dashboard", to: "/dashboard" },
            { label: "Assessments", to: "/assessments" },
            { label: attempt.skillName, to: "/assessments" },
            { label: "Result" },
          ]}
        />
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border/60 bg-card p-8 text-center shadow-sm"
        >
          <span
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
              passed ? "bg-emerald-500/15 text-emerald-600" : "bg-destructive/10 text-destructive"
            }`}
          >
            {passed ? <BadgeCheck className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold">
            {passed ? "Assessment passed" : "Assessment not passed"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {attempt.skillName} · {cfg.label} · pass mark {cfg.passMark}%
          </p>
          <p className="mt-6 font-display text-5xl font-bold text-primary">{attempt.score ?? 0}%</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {attempt.correctCount ?? 0} of {attempt.totalQuestions} correct
          </p>
          {passed && attempt.level === "expert" && (
            <Badge className="mt-4 gap-1 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300">
              <BadgeCheck className="h-3.5 w-3.5" /> AI Verified badge earned
            </Badge>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/assessments">Back to assessments</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/assessments/history">View history</Link>
            </Button>
            <Button onClick={() => navigate({ to: "/skills" })}>Go to my skills</Button>
          </div>
        </motion.section>

        {feedback && (
          <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
            <h2 className="font-display text-xl font-semibold">AI evaluation</h2>
            <p className="mt-2 text-muted-foreground">{feedback.summary}</p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-emerald-600">Strengths</h3>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {feedback.strengths.map((s, i) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-amber-600">Gaps</h3>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {feedback.gaps.map((g, i) => (
                    <li key={i}>• {g}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-5 rounded-xl bg-primary/5 p-4 text-sm">{feedback.recommendation}</p>
          </section>
        )}

        {breakdown.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold">Question review</h2>
            {breakdown.map((b, i) => (
              <div
                key={b.questionId}
                className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  {b.correct ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                  )}
                  <div>
                    <p className="font-medium">
                      {i + 1}. {b.prompt}
                    </p>
                    {b.explanation && (
                      <p className="mt-1 text-sm text-muted-foreground">{b.explanation}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}
      </main>
    </DashboardChrome>
  );
}
