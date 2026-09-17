import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminQuestion, AdminSkillOption, QuestionStatus } from "@/lib/admin-shared";
import type { AssessmentLevel } from "@/lib/assessment-shared";

export type QuestionDraft = {
  id?: string;
  skillId: string;
  level: AssessmentLevel;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  status: QuestionStatus;
};

export function emptyDraft(skillId: string): QuestionDraft {
  return {
    skillId,
    level: "beginner",
    prompt: "",
    options: ["", "", "", ""],
    correctIndex: 0,
    explanation: "",
    status: "draft",
  };
}

export function draftFrom(q: AdminQuestion): QuestionDraft {
  return {
    id: q.id,
    skillId: q.skillId,
    level: q.level,
    prompt: q.prompt,
    options: q.options.length ? q.options : ["", "", "", ""],
    correctIndex: q.correctIndex,
    explanation: q.explanation ?? "",
    status: q.status,
  };
}

export function QuestionEditorDialog({
  open,
  onOpenChange,
  skills,
  initial,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  skills: AdminSkillOption[];
  initial: QuestionDraft | null;
  saving: boolean;
  onSave: (draft: QuestionDraft) => void;
}) {
  const [draft, setDraft] = useState<QuestionDraft>(initial ?? emptyDraft(""));

  useEffect(() => {
    if (open && initial) setDraft(initial);
  }, [open, initial]);

  function setOption(index: number, value: string) {
    setDraft((d) => ({ ...d, options: d.options.map((o, i) => (i === index ? value : o)) }));
  }

  function submit() {
    if (!draft.skillId) return toast.error("Choose a skill.");
    if (draft.prompt.trim().length < 8) return toast.error("Write a longer question prompt.");
    const options = draft.options.map((o) => o.trim());
    if (options.filter(Boolean).length !== options.length) return toast.error("Fill every option.");
    if (options.length < 2) return toast.error("Add at least two options.");
    if (draft.correctIndex >= options.length) return toast.error("Pick the correct answer.");
    onSave({ ...draft, options });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{draft.id ? "Edit question" : "New question"}</DialogTitle>
          <DialogDescription>
            Multiple choice with exactly one correct answer. Published questions enter the live
            assessment pool.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label>Skill</Label>
              <Select
                value={draft.skillId}
                onValueChange={(v) => setDraft((d) => ({ ...d, skillId: v }))}
              >
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
              <Select
                value={draft.level}
                onValueChange={(v) => setDraft((d) => ({ ...d, level: v as AssessmentLevel }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prompt">Question</Label>
            <Textarea
              id="prompt"
              rows={3}
              value={draft.prompt}
              onChange={(e) => setDraft((d) => ({ ...d, prompt: e.target.value }))}
              placeholder="What does the principle of least privilege require?"
            />
          </div>

          <div className="space-y-3">
            <Label>Options — select the correct answer</Label>
            <RadioGroup
              value={String(draft.correctIndex)}
              onValueChange={(v) => setDraft((d) => ({ ...d, correctIndex: Number(v) }))}
              className="space-y-2"
            >
              {draft.options.map((option, i) => (
                <div key={i} className="flex items-center gap-3">
                  <RadioGroupItem value={String(i)} id={`opt-${i}`} />
                  <Input
                    value={option}
                    onChange={(e) => setOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                  />
                  {draft.options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove option ${i + 1}`}
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          options: d.options.filter((_, idx) => idx !== i),
                          correctIndex: d.correctIndex >= i && d.correctIndex > 0 ? d.correctIndex - 1 : d.correctIndex,
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </RadioGroup>
            {draft.options.length < 6 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDraft((d) => ({ ...d, options: [...d.options, ""] }))}
              >
                <Plus className="h-4 w-4" /> Add option
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="explanation">Explanation (shown after grading)</Label>
            <Textarea
              id="explanation"
              rows={2}
              value={draft.explanation}
              onChange={(e) => setDraft((d) => ({ ...d, explanation: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={draft.status}
              onValueChange={(v) => setDraft((d) => ({ ...d, status: v as QuestionStatus }))}
            >
              <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save question"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
