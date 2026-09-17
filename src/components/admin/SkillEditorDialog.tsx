import { useEffect, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminSkillRecord } from "@/lib/admin-shared";

export type SkillDraft = {
  id?: string;
  slug: string;
  name: string;
  category: string;
  difficulty: string;
  iconKey: string;
  description: string;
  isActive: boolean;
};

export function emptySkillDraft(): SkillDraft {
  return {
    slug: "",
    name: "",
    category: "",
    difficulty: "Intermediate",
    iconKey: "Sparkles",
    description: "",
    isActive: true,
  };
}

export function skillDraftFrom(s: AdminSkillRecord): SkillDraft {
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    category: s.category,
    difficulty: s.difficulty,
    iconKey: s.iconKey,
    description: s.description ?? "",
    isActive: s.isActive,
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function SkillEditorDialog({
  open,
  onOpenChange,
  initial,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: SkillDraft | null;
  saving: boolean;
  onSave: (draft: SkillDraft) => void;
}) {
  const [draft, setDraft] = useState<SkillDraft>(initial ?? emptySkillDraft());
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.id));

  useEffect(() => {
    if (open) {
      setDraft(initial ?? emptySkillDraft());
      setSlugTouched(Boolean(initial?.id));
    }
  }, [open, initial]);

  function submit() {
    if (draft.name.trim().length < 2) return toast.error("Give the skill a name.");
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(draft.slug)) {
      return toast.error("Slug must be lowercase letters, numbers and hyphens only.");
    }
    if (draft.category.trim().length < 2) return toast.error("Give the skill a category.");
    onSave(draft);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{draft.id ? "Edit skill" : "New skill"}</DialogTitle>
          <DialogDescription>
            Skills power the assessment catalog. Deactivate instead of deleting once questions or
            attempts reference a skill.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="skill-name">Name</Label>
            <Input
              id="skill-name"
              value={draft.name}
              onChange={(e) => {
                const name = e.target.value;
                setDraft((d) => ({ ...d, name, slug: slugTouched ? d.slug : slugify(name) }));
              }}
              placeholder="e.g. Cloud Security"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="skill-slug">Slug</Label>
            <Input
              id="skill-slug"
              value={draft.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setDraft((d) => ({ ...d, slug: slugify(e.target.value) }));
              }}
              placeholder="cloud-security"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="skill-category">Category</Label>
              <Input
                id="skill-category"
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                placeholder="Cybersecurity"
              />
            </div>
            <div className="space-y-2">
              <Label>Difficulty</Label>
              <Select
                value={draft.difficulty}
                onValueChange={(v) => setDraft((d) => ({ ...d, difficulty: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Beginner">Beginner</SelectItem>
                  <SelectItem value="Intermediate">Intermediate</SelectItem>
                  <SelectItem value="Advanced">Advanced</SelectItem>
                  <SelectItem value="Expert">Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="skill-icon">Icon key</Label>
            <Input
              id="skill-icon"
              value={draft.iconKey}
              onChange={(e) => setDraft((d) => ({ ...d, iconKey: e.target.value }))}
              placeholder="Shield"
            />
            <p className="text-xs text-muted-foreground">
              A lucide-react icon name (e.g. Shield, Braces, Cloud). Unknown keys fall back to a
              default icon.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="skill-description">Description</Label>
            <Textarea
              id="skill-description"
              rows={3}
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border/70 p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Active</p>
              <p className="text-xs text-muted-foreground">
                Inactive skills are hidden from candidates but keep their history.
              </p>
            </div>
            <Switch
              checked={draft.isActive}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, isActive: v }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save skill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
