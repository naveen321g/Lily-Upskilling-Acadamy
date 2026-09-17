import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { BadgeCheck, Gavel, History, Play, Trophy, Zap } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchBar } from "@/components/shared/SearchBar";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { skillIcon } from "@/lib/skill-icons";
import { LEVEL_CONFIG, RETAKE_CAP, type AssessmentLevel } from "@/lib/assessment-shared";
import { listSkillCatalog, startAttempt } from "@/lib/assessment.functions";
import { listMyRetakeRequests, requestRetake } from "@/lib/retake.functions";

/**
 * Deep-link contract for the Bustler app handoff (spec: "the selected
 * category and skill are automatically passed from the Bustler app to the
 * website and pre-filled"). e.g. /assessments?skill=electrician — `skill` is
 * the catalog slug, not the internal uuid, since that's the stable
 * identifier an external caller would know.
 */
const assessmentsSearchSchema = z.object({
  skill: z.string().optional(),
  category: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/assessments/")({
  validateSearch: (search) => assessmentsSearchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "AI Skill Assessments — LUA" },
      {
        name: "description",
        content:
          "Take AI-evaluated beginner and expert skill assessments and earn your AI Verified badge at Lily Upskilling Academy.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AssessmentsHome,
});

function AssessmentsHome() {
  const fetchCatalog = useServerFn(listSkillCatalog);
  const begin = useServerFn(startAttempt);
  const fetchRetakeRequests = useServerFn(listMyRetakeRequests);
  const submitRetake = useServerFn(requestRetake);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const [query, setQuery] = useState(search.category ?? "");
  const [pending, setPending] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [retakeTarget, setRetakeTarget] = useState<{
    skillId: string;
    skillName: string;
    level: AssessmentLevel;
  } | null>(null);
  const [retakeReason, setRetakeReason] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["skill-catalog"],
    queryFn: () => fetchCatalog(),
  });
  const { data: retakeRequests } = useQuery({
    queryKey: ["my-retake-requests"],
    queryFn: () => fetchRetakeRequests(),
  });

  const retakeMutation = useMutation({
    mutationFn: (args: { skillId: string; level: AssessmentLevel; reason: string }) =>
      submitRetake({ data: args }),
    onSuccess: () => {
      toast.success("Retake request submitted for review.");
      queryClient.invalidateQueries({ queryKey: ["my-retake-requests"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not submit retake request."),
    onSettled: () => {
      setRetakeTarget(null);
      setRetakeReason("");
    },
  });

  function pendingRetakeFor(skillId: string, level: AssessmentLevel) {
    return (retakeRequests ?? []).find(
      (r) => r.skillId === skillId && r.level === level && r.status === "pending",
    );
  }

  const highlighted = useMemo(
    () => (search.skill ? (data ?? []).find((s) => s.slug === search.skill) : undefined),
    [data, search.skill],
  );

  useEffect(() => {
    if (highlighted && !scrolled && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      setScrolled(true);
    }
  }, [highlighted, scrolled]);

  const skills = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q
      ? (data ?? [])
      : (data ?? []).filter(
          (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q),
        );
    // A skill deep-linked from Bustler always stays visible, even if the
    // category text they sent doesn't exactly match our filter.
    if (highlighted && !list.some((s) => s.id === highlighted.id)) {
      return [highlighted, ...list];
    }
    return list;
  }, [data, query, highlighted]);

  async function start(skillId: string, level: AssessmentLevel) {
    setPending(`${skillId}:${level}`);
    try {
      const { attemptId } = await begin({ data: { skillId, level } });
      navigate({ to: "/assessments/attempt/$id", params: { id: attemptId } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the assessment.");
    } finally {
      setPending(null);
    }
  }

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: "Dashboard", to: "/dashboard" }, { label: "Assessments" }]} />
        <PageHeader
          eyebrow="AI evaluation"
          title="Skill assessments"
          subtitle="Choose a skill, pick a level, and let our AI evaluator score your answers. Pass the expert assessment to earn a verified certificate."
          actions={
            <Button variant="outline" asChild>
              <Link to="/assessments/history">
                <History className="h-4 w-4" /> Assessment history
              </Link>
            </Button>
          }
        />

        {highlighted && (
          <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-5 py-3 text-sm">
            <Zap className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-foreground">
              Continuing your <span className="font-semibold">{highlighted.name}</span> verification
              — pick a level below to get started.
            </span>
          </div>
        )}

        <div className="max-w-md">
          <SearchBar value={query} onChange={setQuery} placeholder="Search skills or categories" />
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <LoadingSkeleton key={i} className="h-64" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Couldn't load the skill catalog"
            description="Please try again."
            onRetry={() => refetch()}
          />
        ) : skills.length === 0 ? (
          <p className="rounded-2xl border border-border/60 bg-card p-10 text-center text-muted-foreground">
            No skills match your search.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {skills.map((skill, i) => {
              const Icon = skillIcon(skill.iconKey);
              const isHighlighted = highlighted?.id === skill.id;
              return (
                <motion.article
                  key={skill.id}
                  ref={isHighlighted ? highlightRef : undefined}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.3) }}
                  className={`flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${
                    isHighlighted ? "border-primary ring-2 ring-primary/30" : "border-border/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <h2 className="font-display text-lg font-semibold leading-tight">
                          {skill.name}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          {skill.category} · {skill.difficulty}
                        </p>
                      </div>
                    </div>
                    {skill.aiVerified && (
                      <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300">
                        <BadgeCheck className="h-3.5 w-3.5" /> AI Verified
                      </Badge>
                    )}
                  </div>

                  {skill.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {skill.description}
                    </p>
                  )}

                  <dl className="flex items-center gap-6 text-sm">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Best score
                      </dt>
                      <dd className="font-semibold">
                        {skill.bestScore === null ? "—" : `${skill.bestScore}%`}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Attempts
                      </dt>
                      <dd className="font-semibold">{skill.attempts}</dd>
                    </div>
                  </dl>

                  <div className="mt-auto grid gap-2 sm:grid-cols-2">
                    {(["beginner", "expert"] as AssessmentLevel[]).map((level) => {
                      const cfg = LEVEL_CONFIG[level];
                      const available =
                        (level === "beginner" ? skill.beginnerQuestions : skill.expertQuestions) >=
                        cfg.questionCount;
                      const attemptsUsed =
                        level === "beginner"
                          ? skill.beginnerAttemptsUsed
                          : skill.expertAttemptsUsed;
                      const hasApprovedRetake =
                        level === "beginner"
                          ? skill.hasApprovedRetakeBeginner
                          : skill.hasApprovedRetakeExpert;
                      const capReached = attemptsUsed >= RETAKE_CAP && !hasApprovedRetake;
                      const pendingRetake = pendingRetakeFor(skill.id, level);

                      if (capReached) {
                        return (
                          <Button
                            key={level}
                            variant="outline"
                            className="text-amber-700 hover:text-amber-800"
                            disabled={Boolean(pendingRetake)}
                            onClick={() =>
                              setRetakeTarget({ skillId: skill.id, skillName: skill.name, level })
                            }
                            title={
                              pendingRetake
                                ? "Your retake request is awaiting admin review."
                                : `You've used all ${RETAKE_CAP} ${cfg.label.toLowerCase()} attempts — request another.`
                            }
                          >
                            <Gavel className="h-4 w-4" />
                            {pendingRetake ? "Retake requested" : `Request ${cfg.label} retake`}
                          </Button>
                        );
                      }
                      return (
                        <Button
                          key={level}
                          variant={level === "expert" ? "default" : "outline"}
                          disabled={!available || pending === `${skill.id}:${level}`}
                          onClick={() => start(skill.id, level)}
                          title={
                            available
                              ? cfg.blurb
                              : "Not enough published questions for this level yet."
                          }
                        >
                          {level === "expert" ? (
                            <Trophy className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                          {cfg.label}
                        </Button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Beginner: {LEVEL_CONFIG.beginner.questionCount} questions ·{" "}
                    {LEVEL_CONFIG.beginner.durationMinutes} min — Expert:{" "}
                    {LEVEL_CONFIG.expert.questionCount} questions ·{" "}
                    {LEVEL_CONFIG.expert.durationMinutes} min
                  </p>
                </motion.article>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={Boolean(retakeTarget)} onOpenChange={(open) => !open && setRetakeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Request a {retakeTarget && LEVEL_CONFIG[retakeTarget.level].label.toLowerCase()}{" "}
              retake — {retakeTarget?.skillName}
            </DialogTitle>
            <DialogDescription>
              You've used all {RETAKE_CAP} attempts for this assessment. Explain why you'd like
              another one — an admin will review it.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={retakeReason}
            onChange={(e) => setRetakeReason(e.target.value)}
            placeholder="Why should you get another attempt? (at least 10 characters)"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetakeTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={retakeMutation.isPending || retakeReason.trim().length < 10}
              onClick={() =>
                retakeTarget &&
                retakeMutation.mutate({
                  skillId: retakeTarget.skillId,
                  level: retakeTarget.level,
                  reason: retakeReason.trim(),
                })
              }
            >
              Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardChrome>
  );
}
