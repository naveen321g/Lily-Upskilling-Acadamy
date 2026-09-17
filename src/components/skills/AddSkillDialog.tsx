import { useMemo, useState } from "react";
import { Plus, Sparkles } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchBar } from "@/components/shared/SearchBar";
import { skillIcon } from "@/lib/skill-icons";
import type { SkillCatalogEntry } from "@/lib/assessment-shared";

export function AddSkillDialog({
  open,
  onOpenChange,
  catalog,
  addedIds,
  onAdd,
  addingId,
  onRequestNew,
  requesting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  catalog: SkillCatalogEntry[];
  addedIds: Set<string>;
  onAdd: (skillId: string) => void;
  addingId: string | null;
  onRequestNew: (input: { name: string; category?: string; notes?: string }) => void;
  requesting: boolean;
}) {
  const [query, setQuery] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [reqName, setReqName] = useState("");
  const [reqCategory, setReqCategory] = useState("");
  const [reqNotes, setReqNotes] = useState("");

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog
      .filter((s) => !addedIds.has(s.id))
      .filter(
        (s) => !q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q),
      );
  }, [catalog, addedIds, query]);

  function submitRequest() {
    if (reqName.trim().length < 2) return;
    onRequestNew({
      name: reqName.trim(),
      category: reqCategory.trim() || undefined,
      notes: reqNotes.trim() || undefined,
    });
    setReqName("");
    setReqCategory("");
    setReqNotes("");
    setRequestOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a skill</DialogTitle>
          <DialogDescription>
            Add a skill from the catalog to start tracking and verifying it on your profile.
          </DialogDescription>
        </DialogHeader>

        <SearchBar value={query} onChange={setQuery} placeholder="Search the skill catalog…" />

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {available.length ? (
            available.map((s) => {
              const Icon = skillIcon(s.iconKey);
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.category}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={addingId === s.id}
                    onClick={() => onAdd(s.id)}
                  >
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
              );
            })
          ) : (
            <p className="rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
              {query ? "No matching skills." : "You've added every skill in the catalog."}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
          {requestOpen ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="req-name">Skill name</Label>
                <Input
                  id="req-name"
                  value={reqName}
                  onChange={(e) => setReqName(e.target.value)}
                  placeholder="e.g. Solar Panel Installation"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="req-category">Category (optional)</Label>
                <Input
                  id="req-category"
                  value={reqCategory}
                  onChange={(e) => setReqCategory(e.target.value)}
                  placeholder="e.g. Home Services"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="req-notes">Notes for the reviewer (optional)</Label>
                <Textarea
                  id="req-notes"
                  rows={2}
                  value={reqNotes}
                  onChange={(e) => setReqNotes(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setRequestOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" disabled={requesting} onClick={submitRequest}>
                  {requesting ? "Submitting…" : "Submit request"}
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setRequestOpen(true)}
              className="flex w-full items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <Sparkles className="h-4 w-4" />
              Can't find your skill? Request a new one
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
