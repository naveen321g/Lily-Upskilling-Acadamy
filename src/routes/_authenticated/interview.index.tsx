import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, MessageSquare, Sparkles, XCircle } from "lucide-react";
import { toast } from "sonner";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchBar } from "@/components/shared/SearchBar";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  listInterviewSkillOptions,
  listMyInterviewSessions,
  startInterview,
} from "@/lib/interview.functions";
import { requestNewSkill } from "@/lib/skills.functions";
import { skillIcon } from "@/lib/skill-icons";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/interview/")({
  head: () => ({
    meta: [
      { title: "AI Interview — LUA" },
      {
        name: "description",
        content:
          "A conversational, AI-led interview that adapts to your answers — a different way to demonstrate a skill at Lily Upskilling Academy.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InterviewHome,
});

function InterviewHome() {
  const fetchSkills = useServerFn(listInterviewSkillOptions);
  const fetchSessions = useServerFn(listMyInterviewSessions);
  const begin = useServerFn(startInterview);
  const submitRequest = useServerFn(requestNewSkill);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [reqName, setReqName] = useState("");
  const [reqCategory, setReqCategory] = useState("");
  const [reqNotes, setReqNotes] = useState("");

  const {
    data: skills,
    isLoading: skillsLoading,
    isError: skillsError,
    refetch: refetchSkills,
  } = useQuery({
    queryKey: ["interview-skill-options"],
    queryFn: () => fetchSkills(),
  });
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["my-interview-sessions"],
    queryFn: () => fetchSessions(),
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = skills ?? [];
    if (!q) return list;
    return list.filter(
      (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q),
    );
  }, [skills, query]);

  async function start(skillId: string) {
    setPending(skillId);
    try {
      const session = await begin({ data: { skillId } });
      navigate({ to: "/interview/$sessionId", params: { sessionId: session.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the interview.");
    } finally {
      setPending(null);
    }
  }

  const requestMutation = useMutation({
    mutationFn: (input: { name: string; category?: string; notes?: string }) =>
      submitRequest({ data: input }),
    onSuccess: () => {
      toast.success("Skill request submitted for review.");
      queryClient.invalidateQueries({ queryKey: ["my-skill-requests"] });
      setRequestOpen(false);
      setReqName("");
      setReqCategory("");
      setReqNotes("");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not submit skill request."),
  });

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <Breadcrumbs
          items={[{ label: "Dashboard", to: "/dashboard" }, { label: "AI Interview" }]}
        />
        <PageHeader
          eyebrow="Conversational assessment"
          title="AI Interview"
          subtitle="A senior-style interviewer asks real, scenario-based questions and adapts to how you answer — no fixed question bank, no two interviews alike."
        />

        <div className="max-w-md">
          <SearchBar value={query} onChange={setQuery} placeholder="Search skills or categories" />
        </div>

        {skillsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <LoadingSkeleton key={i} className="h-32" />
            ))}
          </div>
        ) : skillsError ? (
          <ErrorState
            title="Couldn't load the skill list"
            description="Please try again."
            onRetry={() => refetchSkills()}
          />
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">
              {query
                ? `No skill matches "${query}".`
                : "No skills are available for an AI interview yet."}
            </p>
            <Button
              variant="outline"
              className="mt-4 gap-1"
              onClick={() => {
                setReqName(query);
                setRequestOpen(true);
              }}
            >
              <Sparkles className="h-4 w-4" /> Request this skill
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((skill) => {
              const Icon = skillIcon(skill.iconKey);
              return (
                <div
                  key={skill.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="font-display text-base font-semibold leading-tight">
                        {skill.name}
                      </h2>
                      <p className="text-xs text-muted-foreground">{skill.category}</p>
                    </div>
                  </div>
                  <Button
                    className="mt-auto gap-1 bg-gradient-brand text-primary-foreground hover:opacity-95"
                    disabled={pending === skill.id}
                    onClick={() => start(skill.id)}
                  >
                    <MessageSquare className="h-4 w-4" />
                    {pending === skill.id ? "Starting…" : "Start AI Interview"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Your interviews
          </h2>
          {sessionsLoading ? (
            <LoadingSkeleton className="h-32" />
          ) : sessions?.length ? (
            <div className="space-y-2">
              {sessions.map((s) => (
                <Link
                  key={s.id}
                  to="/interview/$sessionId"
                  params={{ sessionId: s.id }}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
                >
                  <div>
                    <p className="font-medium text-foreground">{s.skillName}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.status === "in_progress" ? "In progress" : "Completed"} ·{" "}
                      {formatDate(s.updatedAt) ?? "—"}
                    </p>
                  </div>
                  {s.status === "completed" &&
                    (s.approved ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300">
                        <BadgeCheck className="h-3 w-3" /> {s.professionalScore}%
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300">
                        <XCircle className="h-3 w-3" /> {s.professionalScore}%
                      </span>
                    ))}
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-border/70 bg-card p-8 text-center text-sm text-muted-foreground">
              No interviews yet — start one above.
            </p>
          )}
        </section>
      </main>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a skill</DialogTitle>
            <DialogDescription>
              Can't find the skill you're looking for? Ask an admin to add it to the catalog — once
              approved, it'll be available for both AI Interview and standard assessments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="interview-req-name">Skill name</Label>
              <Input
                id="interview-req-name"
                value={reqName}
                onChange={(e) => setReqName(e.target.value)}
                placeholder="e.g. Solar Panel Installation"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interview-req-category">Category (optional)</Label>
              <Input
                id="interview-req-category"
                value={reqCategory}
                onChange={(e) => setReqCategory(e.target.value)}
                placeholder="e.g. Home Services"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interview-req-notes">Notes for the reviewer (optional)</Label>
              <Textarea
                id="interview-req-notes"
                rows={3}
                value={reqNotes}
                onChange={(e) => setReqNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={requestMutation.isPending || reqName.trim().length < 2}
              onClick={() =>
                requestMutation.mutate({
                  name: reqName.trim(),
                  category: reqCategory.trim() || undefined,
                  notes: reqNotes.trim() || undefined,
                })
              }
            >
              {requestMutation.isPending ? "Submitting…" : "Submit request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardChrome>
  );
}
