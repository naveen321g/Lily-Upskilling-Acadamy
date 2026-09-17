import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { CheckCircle2, FileEdit, Plus, Shield, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchBar } from "@/components/shared/SearchBar";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  QuestionEditorDialog,
  draftFrom,
  emptyDraft,
  type QuestionDraft,
} from "@/components/admin/QuestionEditorDialog";
import { AiGeneratorDialog } from "@/components/admin/AiGeneratorDialog";
import type { AdminQuestion, QuestionStatus } from "@/lib/admin-shared";
import type { AssessmentLevel } from "@/lib/assessment-shared";
import {
  deleteQuestions,
  generateQuestions,
  listQuestionBank,
  saveGeneratedQuestions,
  saveQuestion,
  setQuestionStatus,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/questions")({
  head: () => ({
    meta: [
      { title: "Question bank — LUA admin" },
      {
        name: "description",
        content:
          "Curate, generate and publish the assessment question bank powering LUA skill verification.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: QuestionBankPage,
});

const ALL = "all";

const QUESTION_STATUS_LABEL: Record<QuestionStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

function QuestionBankPage() {
  const fetchBank = useServerFn(listQuestionBank);
  const save = useServerFn(saveQuestion);
  const setStatus = useServerFn(setQuestionStatus);
  const remove = useServerFn(deleteQuestions);
  const generate = useServerFn(generateQuestions);
  const saveGenerated = useServerFn(saveGeneratedQuestions);
  const queryClient = useQueryClient();

  const [skillFilter, setSkillFilter] = useState(ALL);
  const [levelFilter, setLevelFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editorOpen, setEditorOpen] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [draft, setDraft] = useState<QuestionDraft | null>(null);

  const filters = {
    skillId: skillFilter === ALL ? undefined : skillFilter,
    level: levelFilter === ALL ? undefined : (levelFilter as AssessmentLevel),
    status: statusFilter === ALL ? undefined : (statusFilter as QuestionStatus),
    search: search.trim() || undefined,
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["question-bank", filters],
    queryFn: () => fetchBank({ data: filters }),
  });

  const skills = data?.skills ?? [];
  const questions = data?.questions ?? [];

  function invalidate() {
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ["question-bank"] });
    queryClient.invalidateQueries({ queryKey: ["skill-catalog"] });
  }

  const saveMutation = useMutation({
    mutationFn: (d: QuestionDraft) =>
      save({
        data: {
          id: d.id,
          skillId: d.skillId,
          level: d.level,
          prompt: d.prompt,
          options: d.options,
          correctIndex: d.correctIndex,
          explanation: d.explanation,
          status: d.status,
        },
      }),
    onSuccess: () => {
      toast.success("Question saved.");
      setEditorOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save."),
  });

  const statusMutation = useMutation({
    mutationFn: (args: { ids: string[]; status: QuestionStatus }) => setStatus({ data: args }),
    onSuccess: (_r, args) => {
      toast.success(`${args.ids.length} question(s) marked ${args.status}.`);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update."),
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => remove({ data: { ids } }),
    onSuccess: () => {
      toast.success("Questions deleted.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete."),
  });

  const stats = data?.stats;
  const allSelected = questions.length > 0 && selected.size === questions.length;

  const readiness = useMemo(
    () => skills.filter((s) => s.beginnerPublished < 5 || s.expertPublished < 15),
    [skills],
  );

  if (error) {
    const message = error instanceof Error ? error.message : "";
    const isAccessError = /admin/i.test(message);
    return (
      <DashboardChrome>
        <main className="mx-auto max-w-3xl px-4 py-20 text-center">
          <Shield className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 font-display text-2xl font-semibold">
            {isAccessError ? "Admin access required" : "Something went wrong"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {isAccessError
              ? "Your account does not have the admin role, so the question bank is unavailable."
              : "We couldn't load the question bank. Please try again."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            {!isAccessError && (
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            )}
            <Button asChild>
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </main>
      </DashboardChrome>
    );
  }

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: "Admin", to: "/admin" }, { label: "Question Bank" }]} />
        <PageHeader
          eyebrow="Admin"
          title="Question bank"
          subtitle="Author, generate and publish the questions that power every AI-evaluated assessment."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setGeneratorOpen(true)}>
                <Sparkles className="h-4 w-4" /> Generate with AI
              </Button>
              <Button
                onClick={() => {
                  setDraft(emptyDraft(skillFilter === ALL ? (skills[0]?.id ?? "") : skillFilter));
                  setEditorOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> New question
              </Button>
            </div>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total questions", value: stats?.total ?? 0 },
            { label: "Published", value: stats?.published ?? 0 },
            { label: "Drafts", value: stats?.draft ?? 0 },
            { label: "AI generated", value: stats?.aiGenerated ?? 0 },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm"
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className="mt-1 font-display text-3xl font-bold text-primary">{s.value}</p>
            </motion.div>
          ))}
        </div>

        {readiness.length > 0 && (
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <h2 className="font-display text-lg font-semibold">Coverage gaps</h2>
            <p className="text-sm text-muted-foreground">
              A skill needs 5 published beginner and 15 published expert questions to be assessable.
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {readiness.map((s) => (
                <li key={s.id}>
                  <Badge variant="outline" className="gap-2">
                    {s.name}
                    <span className="text-muted-foreground">
                      {s.beginnerPublished}/5 · {s.expertPublished}/15
                    </span>
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-4">
          <SearchBar value={search} onChange={setSearch} placeholder="Search question prompts" />
          <Select value={skillFilter} onValueChange={setSkillFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All skills" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All skills</SelectItem>
              {skills.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All levels</SelectItem>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="expert">Expert</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <Button
              size="sm"
              onClick={() => statusMutation.mutate({ ids: [...selected], status: "published" })}
            >
              <CheckCircle2 className="h-4 w-4" /> Publish
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => statusMutation.mutate({ ids: [...selected], status: "draft" })}
            >
              Unpublish
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => statusMutation.mutate({ ids: [...selected], status: "archived" })}
            >
              Archive
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => deleteMutation.mutate([...selected])}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <LoadingSkeleton key={i} className="h-24" />
            ))}
          </div>
        ) : questions.length === 0 ? (
          <p className="rounded-2xl border border-border/60 bg-card p-10 text-center text-muted-foreground">
            No questions match these filters. Create one or generate a batch with AI.
          </p>
        ) : (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(v) =>
                  setSelected(v ? new Set(questions.map((q) => q.id)) : new Set())
                }
              />
              Select all {questions.length}
            </label>
            <ul className="space-y-3">
              {questions.map((q) => (
                <QuestionRow
                  key={q.id}
                  question={q}
                  checked={selected.has(q.id)}
                  onToggle={(v) =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (v) next.add(q.id);
                      else next.delete(q.id);
                      return next;
                    })
                  }
                  onEdit={() => {
                    setDraft(draftFrom(q));
                    setEditorOpen(true);
                  }}
                />
              ))}
            </ul>
          </div>
        )}
      </main>

      <QuestionEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        skills={skills}
        initial={draft}
        saving={saveMutation.isPending}
        onSave={(d) => saveMutation.mutate(d)}
      />

      <AiGeneratorDialog
        open={generatorOpen}
        onOpenChange={setGeneratorOpen}
        skills={skills}
        onGenerate={async (args) => (await generate({ data: args })).questions}
        onSave={async (args) => {
          await saveGenerated({ data: args });
          invalidate();
        }}
      />
    </DashboardChrome>
  );
}

function QuestionRow({
  question,
  checked,
  onToggle,
  onEdit,
}: {
  question: AdminQuestion;
  checked: boolean;
  onToggle: (v: boolean) => void;
  onEdit: () => void;
}) {
  return (
    <li className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onToggle(Boolean(v))}
          aria-label="Select question"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{question.skillName}</Badge>
            <Badge variant="outline">{question.level}</Badge>
            <Badge
              className={
                question.status === "published"
                  ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
                  : question.status === "archived"
                    ? "bg-muted text-muted-foreground hover:bg-muted"
                    : "bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 dark:text-amber-300"
              }
            >
              {QUESTION_STATUS_LABEL[question.status]}
            </Badge>
            {question.source === "ai" && (
              <Badge variant="outline" className="gap-1">
                <Sparkles className="h-3 w-3" /> AI
              </Badge>
            )}
          </div>
          <p className="mt-2 font-medium">{question.prompt}</p>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {question.options.map((o, i) => (
              <li
                key={i}
                className={
                  i === question.correctIndex
                    ? "font-medium text-emerald-700 dark:text-emerald-300"
                    : "text-muted-foreground"
                }
              >
                {String.fromCharCode(65 + i)}. {o}
              </li>
            ))}
          </ul>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <FileEdit className="h-4 w-4" /> Edit
        </Button>
      </div>
    </li>
  );
}
