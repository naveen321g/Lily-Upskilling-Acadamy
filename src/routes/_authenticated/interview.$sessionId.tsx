import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { BackLink } from "@/components/shared/BackLink";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ChatBubble } from "@/components/interview/ChatBubble";
import { TypingIndicator } from "@/components/interview/TypingIndicator";
import { ExperiencePicker } from "@/components/interview/ExperiencePicker";
import { InterviewReport } from "@/components/interview/InterviewReport";
import {
  getInterviewSession,
  setInterviewExperienceLevel,
  submitInterviewAnswer,
} from "@/lib/interview.functions";
import type { InterviewExperienceLevel } from "@/lib/interview-shared";

export const Route = createFileRoute("/_authenticated/interview/$sessionId")({
  head: () => ({
    meta: [{ title: "AI Interview — LUA" }, { name: "robots", content: "noindex" }],
  }),
  component: InterviewSessionPage,
});

function InterviewSessionPage() {
  const { sessionId } = Route.useParams();
  const fetchSession = useServerFn(getInterviewSession);
  const setExperience = useServerFn(setInterviewExperienceLevel);
  const submitAnswer = useServerFn(submitInterviewAnswer);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["interview-session", sessionId],
    queryFn: () => fetchSession({ data: { sessionId } }),
  });

  const [answer, setAnswer] = useState("");
  const seenRef = useRef<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement | null>(null);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["interview-session", sessionId] });
    queryClient.invalidateQueries({ queryKey: ["my-interview-sessions"] });
  }

  const experienceMutation = useMutation({
    mutationFn: (level: InterviewExperienceLevel) => setExperience({ data: { sessionId, level } }),
    onSuccess: refresh,
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not start the interview."),
  });

  const answerMutation = useMutation({
    mutationFn: (text: string) => submitAnswer({ data: { sessionId, answer: text } }),
    onSuccess: () => {
      setAnswer("");
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not submit your answer."),
  });

  const busy = experienceMutation.isPending || answerMutation.isPending;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [data?.messages.length, busy]);

  function send() {
    const text = answer.trim();
    if (!text || busy) return;
    answerMutation.mutate(text);
  }

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <Breadcrumbs
          items={[
            { label: "Dashboard", to: "/dashboard" },
            { label: "AI Interview", to: "/interview" },
            { label: data?.skillName ?? "Interview" },
          ]}
        />
        <BackLink to="/interview" label="Back to AI Interview" />

        {isLoading ? (
          <div className="space-y-3">
            <LoadingSkeleton className="h-16" />
            <LoadingSkeleton className="h-64" />
          </div>
        ) : isError ? (
          <ErrorState
            title="Couldn't load this interview"
            description="Please try again."
            onRetry={() => refetch()}
          />
        ) : !data ? (
          <p className="rounded-2xl border border-dashed border-border/70 bg-card p-10 text-center text-sm text-muted-foreground">
            Interview not found.
          </p>
        ) : data.status === "completed" && data.report ? (
          <div className="mt-6 space-y-8">
            <InterviewReport report={data.report} />
            <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
              <h2 className="mb-4 font-display text-lg font-semibold">Conversation transcript</h2>
              <div className="space-y-3">
                {data.messages.map((m) => (
                  <ChatBubble key={m.id} message={m} />
                ))}
              </div>
            </section>
          </div>
        ) : (
          <>
            <h1 className="mt-6 font-display text-2xl font-bold tracking-tight text-foreground">
              {data.skillName}
            </h1>
            {data.plannedQuestionCount > 0 && (
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{Math.round(data.progress * 100)}%</span>
                </div>
                <Progress value={data.progress * 100} className="h-2" />
              </div>
            )}

            <div className="mt-6 space-y-3">
              {data.messages.map((m) => {
                const isNew = m.role === "assistant" && !seenRef.current.has(m.id);
                seenRef.current.add(m.id);
                return <ChatBubble key={m.id} message={m} animate={isNew} />;
              })}
              {busy && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>

            <div className="mt-6 rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
              {data.phase === "awaiting_experience" ? (
                <ExperiencePicker
                  disabled={experienceMutation.isPending}
                  onChoose={(level) => experienceMutation.mutate(level)}
                />
              ) : data.awaitingAnswer ? (
                <div className="space-y-3">
                  <Textarea
                    rows={3}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder="Type your answer… (Enter to send, Shift+Enter for a new line)"
                    disabled={busy}
                  />
                  <Button onClick={send} disabled={busy || !answer.trim()} className="gap-1">
                    <Send className="h-4 w-4" /> Send
                  </Button>
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground">
                  Thinking through your last answer…
                </p>
              )}
            </div>
          </>
        )}
      </main>
    </DashboardChrome>
  );
}
