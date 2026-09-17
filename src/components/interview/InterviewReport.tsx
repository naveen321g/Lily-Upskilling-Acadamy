import { BadgeCheck, Star, XCircle } from "lucide-react";
import { motion } from "motion/react";
import type { InterviewReport as InterviewReportData } from "@/lib/interview-shared";

const DIMENSIONS: { key: keyof InterviewReportData; label: string }[] = [
  { key: "knowledge", label: "Technical knowledge" },
  { key: "practicalSkill", label: "Practical skill" },
  { key: "problemSolving", label: "Problem solving" },
  { key: "communication", label: "Communication" },
  { key: "confidence", label: "Confidence" },
  { key: "safety", label: "Safety & best practices" },
];

export function InterviewReport({ report }: { report: InterviewReportData }) {
  return (
    <div className="space-y-8">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border/60 bg-card p-8 text-center shadow-sm"
      >
        <span
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
            report.approved
              ? "bg-emerald-500/15 text-emerald-600"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {report.approved ? <BadgeCheck className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold">
          {report.approved ? "Interview complete" : "Interview complete — not yet certified"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {report.skill} · {report.category} · {report.questionsAsked} questions
        </p>
        <p className="mt-6 font-display text-5xl font-bold text-primary">
          {report.professionalScore}%
        </p>
        <div className="mt-2 flex items-center justify-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${
                i < Math.round(report.rating)
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/30"
              }`}
            />
          ))}
          <span className="ml-1 text-sm text-muted-foreground">{report.level}</span>
        </div>
        {report.approved && (
          <p className="mt-3 text-sm text-muted-foreground">
            Estimated experience: {report.experiencePrediction}
          </p>
        )}
      </motion.section>

      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold">Dimension breakdown</h2>
        <div className="mt-5 space-y-4">
          {DIMENSIONS.map((d) => {
            const value = report[d.key] as number;
            return (
              <div key={d.key}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="font-semibold text-foreground">{value}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-brand"
                    style={{ width: `${Math.min(100, value)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-emerald-600">Strengths</h3>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {report.strengths.length ? (
              report.strengths.map((s, i) => <li key={i}>• {s}</li>)
            ) : (
              <li>Not enough signal yet.</li>
            )}
          </ul>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-amber-600">Areas to improve</h3>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {report.improvements.length ? (
              report.improvements.map((s, i) => <li key={i}>• {s}</li>)
            ) : (
              <li>Nothing specific flagged.</li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
