import { useState } from "react";
import { Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminSkillOption, GeneratedQuestion, QuestionStatus } from "@/lib/admin-shared";
import type { AssessmentLevel } from "@/lib/assessment-shared";

export function AiGeneratorDialog({
  open,
  onOpenChange,
  skills,
  onGenerate,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  skills: AdminSkillOption[];
  onGenerate: (args: {
    skillId: string;
    level: AssessmentLevel;
    count: number;
    topics?: string;
  }) => Promise<GeneratedQuestion[]>;
  onSave: (args: {
    skillId: string;
    level: AssessmentLevel;
    status: QuestionStatus;
    questions: GeneratedQuestion[];
  }) => Promise<void>;
}) {
  const [skillId, setSkillId] = useState("");
  const [level, setLevel] = useState<AssessmentLevel>("beginner");
  const [count, setCount] = useState(5);
  const [topics, setTopics] = useState("");
  const [status, setStatus] = useState<QuestionStatus>("draft");
  const [generated, setGenerated] = useState<GeneratedQuestion[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<"generate" | "save" | null>(null);

  function reset() {
    setGenerated([]);
    setSelected(new Set());
  }

  async function generate() {
    if (!skillId) return toast.error("Choose a skill first.");
    setBusy("generate");
    try {
      const questions = await onGenerate({ skillId, level, count, topics: topics.trim() || undefined });
      setGenerated(questions);
      setSelected(new Set(questions.map((_, i) => i)));
      toast.success(`${questions.length} questions drafted by AI.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generation failed.");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    const chosen = generated.filter((_, i) => selected.has(i));
    if (!chosen.length) return toast.error("Select at least one question.");
    setBusy("save");
    try {
      await onSave({ skillId, level, status, questions: chosen });
      toast.success(`${chosen.length} questions added to the bank.`);
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the questions.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> AI question generator
          </DialogTitle>
          <DialogDescription>
            Draft assessment questions with AI, review them, then publish the ones you trust.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-2 sm:col-span-2">
            <Label>Skill</Label>
            <Select value={skillId} onValueChange={(v) => { setSkillId(v); reset(); }}>
              <SelectTrigger><SelectValue placeholder="Select a skill" /></SelectTrigger>
              <SelectContent>
                {skills.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Level</Label>
            <Select value={level} onValueChange={(v) => { setLevel(v as AssessmentLevel); reset(); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="expert">Expert</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="count">How many</Label>
            <Input
              id="count"
              type="number"
              min={1}
              max={15}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(15, Number(e.target.value) || 1)))}
            />
          </div>
          <div className="space-y-2 sm:col-span-4">
            <Label htmlFor="topics">Focus topics (optional)</Label>
            <Input
              id="topics"
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder="e.g. zero trust, IAM policies, incident response"
            />
          </div>
        </div>

        <Button onClick={generate} disabled={busy !== null} className="w-full sm:w-auto">
          <Wand2 className="h-4 w-4" />
          {busy === "generate" ? "Generating…" : generated.length ? "Regenerate" : "Generate questions"}
        </Button>

        {generated.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                Review {generated.length} drafts · {selected.size} selected
              </p>
              <Select value={status} onValueChange={(v) => setStatus(v as QuestionStatus)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Save as draft</SelectItem>
                  <SelectItem value="published">Publish now</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ul className="space-y-3">
              {generated.map((q, i) => (
                <li key={i} className="rounded-xl border border-border/60 bg-card p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selected.has(i)}
                      onCheckedChange={(v) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (v) next.add(i);
                          else next.delete(i);
                          return next;
                        })
                      }
                      aria-label={`Select question ${i + 1}`}
                    />
                    <div className="space-y-2">
                      <p className="font-medium">{q.prompt}</p>
                      <ul className="space-y-1 text-sm">
                        {q.options.map((o, oi) => (
                          <li
                            key={oi}
                            className={
                              oi === q.correctIndex
                                ? "font-medium text-emerald-700 dark:text-emerald-300"
                                : "text-muted-foreground"
                            }
                          >
                            {String.fromCharCode(65 + oi)}. {o}
                            {oi === q.correctIndex && (
                              <Badge variant="outline" className="ml-2">Correct</Badge>
                            )}
                          </li>
                        ))}
                      </ul>
                      {q.explanation && (
                        <p className="text-xs text-muted-foreground">{q.explanation}</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={save} disabled={busy !== null || !generated.length}>
            {busy === "save" ? "Saving…" : "Add selected to bank"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
