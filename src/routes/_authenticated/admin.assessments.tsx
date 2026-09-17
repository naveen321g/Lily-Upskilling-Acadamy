import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Flag, FlagOff, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { flagAttempt, listAttemptsAdmin, resetAttempt } from "@/lib/admin.functions";
import type { AdminAttemptRecord } from "@/lib/admin-shared";
import { listSkillCatalog } from "@/lib/assessment.functions";
import { listRetakeRequests, reviewRetakeRequest } from "@/lib/retake.functions";
import type { AdminRetakeRequest } from "@/lib/retake-shared";
import { formatDate } from "@/lib/format";
import { attemptState, statusMeta } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/admin/assessments")({
  head: () => ({
    meta: [
      { title: "Assessment activity — LUA admin" },
      {
        name: "description",
        content: "Monitor assessment attempts across all candidates and reset stuck attempts.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AssessmentAdminPage,
});

const ALL = "all";

function AssessmentAdminPage() {
  const fetchAttempts = useServerFn(listAttemptsAdmin);
  const fetchSkills = useServerFn(listSkillCatalog);
  const reset = useServerFn(resetAttempt);
  const flag = useServerFn(flagAttempt);
  const fetchRetakeRequests = useServerFn(listRetakeRequests);
  const reviewRetake = useServerFn(reviewRetakeRequest);
  const queryClient = useQueryClient();

  const [skillId, setSkillId] = useState(ALL);
  const [level, setLevel] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [flagTarget, setFlagTarget] = useState<AdminAttemptRecord | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [rejectRetakeTarget, setRejectRetakeTarget] = useState<AdminRetakeRequest | null>(null);
  const [rejectRetakeReason, setRejectRetakeReason] = useState("");

  const filters = {
    skillId: skillId === ALL ? undefined : skillId,
    level: level === ALL ? undefined : (level as "beginner" | "expert"),
    status: status === ALL ? undefined : status,
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-attempts", filters],
    queryFn: () => fetchAttempts({ data: filters }),
  });
  const { data: skills } = useQuery({ queryKey: ["skill-catalog"], queryFn: () => fetchSkills() });
  const { data: retakeRequests } = useQuery({
    queryKey: ["admin-retake-requests"],
    queryFn: () => fetchRetakeRequests(),
  });

  const resetMutation = useMutation({
    mutationFn: (attemptId: string) => reset({ data: { attemptId } }),
    onSuccess: () => {
      toast.success("Attempt reset — the candidate can start a fresh one.");
      queryClient.invalidateQueries({ queryKey: ["admin-attempts"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not reset attempt."),
  });

  const flagMutation = useMutation({
    mutationFn: (args: { attemptId: string; flagged: boolean; reason?: string }) =>
      flag({ data: args }),
    onSuccess: (_, args) => {
      toast.success(args.flagged ? "Attempt flagged for review." : "Attempt unflagged.");
      queryClient.invalidateQueries({ queryKey: ["admin-attempts"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not update flag."),
    onSettled: () => {
      setFlagTarget(null);
      setFlagReason("");
    },
  });

  const retakeMutation = useMutation({
    mutationFn: (args: {
      requestId: string;
      decision: "approved" | "rejected";
      adminNotes?: string;
    }) => reviewRetake({ data: args }),
    onSuccess: (_, args) => {
      toast.success(args.decision === "approved" ? "Retake approved." : "Retake rejected.");
      queryClient.invalidateQueries({ queryKey: ["admin-retake-requests"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not update the request."),
    onSettled: () => {
      setRejectRetakeTarget(null);
      setRejectRetakeReason("");
    },
  });

  const pendingRetakeRequests = (retakeRequests ?? []).filter((r) => r.status === "pending");

  function confirmRejectRetake() {
    if (!rejectRetakeTarget) return;
    retakeMutation.mutate({
      requestId: rejectRetakeTarget.id,
      decision: "rejected",
      adminNotes: rejectRetakeReason.trim() || undefined,
    });
  }

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <Breadcrumbs items={[{ label: "Admin", to: "/admin" }, { label: "Assessments" }]} />
        <PageHeader
          eyebrow="Admin"
          title="Assessment activity"
          subtitle="Every attempt across every candidate. Reset attempts stuck in progress (e.g. after a crashed browser)."
        />

        {pendingRetakeRequests.length > 0 && (
          <div className="mt-8 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Pending retake requests ({pendingRetakeRequests.length})
            </h2>
            {pendingRetakeRequests.map((r) => (
              <div
                key={r.id}
                className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/40 dark:bg-amber-950/20"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {r.skillName} · {r.level}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.userName} · "{r.reason}"
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={retakeMutation.isPending}
                    onClick={() => retakeMutation.mutate({ requestId: r.id, decision: "approved" })}
                  >
                    <Check className="h-4 w-4" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => setRejectRetakeTarget(r)}
                  >
                    <X className="h-4 w-4" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Select value={skillId} onValueChange={setSkillId}>
            <SelectTrigger>
              <SelectValue placeholder="All skills" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All skills</SelectItem>
              {(skills ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger>
              <SelectValue placeholder="All levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All levels</SelectItem>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="expert">Expert</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="evaluated">Evaluated</SelectItem>
              <SelectItem value="abandoned">Abandoned</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-6 space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <LoadingSkeleton key={i} className="h-20" />)
          ) : isError ? (
            <ErrorState
              title="Couldn't load assessment activity"
              description="Please try again."
              onRetry={() => refetch()}
            />
          ) : data?.length ? (
            data.map((a) => {
              const meta = statusMeta(attemptState(a.status, a.passed));
              const Icon = meta.icon;
              return (
                <div
                  key={a.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{a.skillName}</p>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                        {a.level}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${meta.className}`}
                      >
                        <Icon className="h-3 w-3" /> {meta.label}
                      </span>
                      {a.flagged && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 ring-1 ring-inset ring-red-200">
                          <Flag className="h-3 w-3" /> Flagged
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {a.userName} · Started {formatDate(a.startedAt) ?? "—"}
                      {a.score !== null && ` · Score ${a.score}%`}
                      {a.passed !== null && (a.passed ? " · Passed" : " · Failed")}
                    </p>
                    {a.flagged && a.flagReason && (
                      <p className="mt-1 text-xs text-red-600">Flagged: "{a.flagReason}"</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {a.status === "in_progress" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resetMutation.mutate(a.id)}
                        disabled={resetMutation.isPending}
                      >
                        <RotateCcw className="h-4 w-4" /> Reset attempt
                      </Button>
                    )}
                    {a.flagged ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => flagMutation.mutate({ attemptId: a.id, flagged: false })}
                        disabled={flagMutation.isPending}
                      >
                        <FlagOff className="h-4 w-4" /> Unflag
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setFlagTarget(a)}>
                        <Flag className="h-4 w-4" /> Flag
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="rounded-2xl border border-dashed border-border/70 bg-card p-10 text-center text-sm text-muted-foreground">
              No attempts match these filters.
            </p>
          )}
        </div>
      </main>

      <Dialog open={Boolean(flagTarget)} onOpenChange={(open) => !open && setFlagTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag attempt for review</DialogTitle>
            <DialogDescription>
              Marks {flagTarget?.userName}'s {flagTarget?.skillName} attempt as suspicious. It'll
              show up flagged here and in the Fraud dashboard.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={flagReason}
            onChange={(e) => setFlagReason(e.target.value)}
            placeholder="Reason (optional)…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlagTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={flagMutation.isPending}
              onClick={() =>
                flagTarget &&
                flagMutation.mutate({
                  attemptId: flagTarget.id,
                  flagged: true,
                  reason: flagReason.trim() || undefined,
                })
              }
            >
              Flag attempt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(rejectRetakeTarget)}
        onOpenChange={(open) => !open && setRejectRetakeTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject retake request</DialogTitle>
            <DialogDescription>
              Let {rejectRetakeTarget?.userName} know why the request wasn't approved.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={rejectRetakeReason}
            onChange={(e) => setRejectRetakeReason(e.target.value)}
            placeholder="Reason (optional)…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectRetakeTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRejectRetake}
              disabled={retakeMutation.isPending}
            >
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardChrome>
  );
}
