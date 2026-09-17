import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, FileEdit, Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchBar } from "@/components/shared/SearchBar";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
  SkillEditorDialog,
  emptySkillDraft,
  skillDraftFrom,
  type SkillDraft,
} from "@/components/admin/SkillEditorDialog";
import {
  listSkillRequestsAdmin,
  listSkillsAdmin,
  reviewSkillRequest,
  saveSkill,
  setSkillActive,
} from "@/lib/admin.functions";
import type { AdminSkillRecord, AdminSkillRequest } from "@/lib/admin-shared";

export const Route = createFileRoute("/_authenticated/admin/skills")({
  head: () => ({
    meta: [
      { title: "Skill catalog — LUA admin" },
      {
        name: "description",
        content: "Create, edit and deactivate skills in the LUA assessment catalog.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SkillCatalogAdminPage,
});

function SkillCatalogAdminPage() {
  const fetchSkills = useServerFn(listSkillsAdmin);
  const save = useServerFn(saveSkill);
  const setActive = useServerFn(setSkillActive);
  const fetchRequests = useServerFn(listSkillRequestsAdmin);
  const review = useServerFn(reviewSkillRequest);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-skills"],
    queryFn: () => fetchSkills(),
  });
  const { data: requests } = useQuery({
    queryKey: ["admin-skill-requests"],
    queryFn: () => fetchRequests(),
  });

  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<SkillDraft | null>(null);
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminSkillRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const reviewMutation = useMutation({
    mutationFn: (args: {
      id: string;
      decision: "approved" | "rejected";
      adminNotes?: string;
      resultingSkillId?: string;
    }) => review({ data: args }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-skill-requests"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not update the request."),
  });

  const saveMutation = useMutation({
    mutationFn: (d: SkillDraft) =>
      save({
        data: {
          id: d.id,
          slug: d.slug,
          name: d.name,
          category: d.category,
          difficulty: d.difficulty as "Beginner" | "Intermediate" | "Advanced" | "Expert",
          iconKey: d.iconKey,
          description: d.description || undefined,
          isActive: d.isActive,
        },
      }),
    onSuccess: (result) => {
      toast.success("Skill saved.");
      setEditorOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-skills"] });
      queryClient.invalidateQueries({ queryKey: ["skill-catalog"] });
      if (approvingRequestId) {
        reviewMutation.mutate({
          id: approvingRequestId,
          decision: "approved",
          resultingSkillId: result.id,
        });
        setApprovingRequestId(null);
      }
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save skill."),
  });

  const toggleMutation = useMutation({
    mutationFn: (args: { id: string; isActive: boolean }) => setActive({ data: args }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-skills"] });
      queryClient.invalidateQueries({ queryKey: ["skill-catalog"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not update skill."),
  });

  const pendingRequests = (requests ?? []).filter((r) => r.status === "pending");

  function approveRequest(request: AdminSkillRequest) {
    setApprovingRequestId(request.id);
    setDraft({ ...emptySkillDraft(), name: request.name, category: request.category ?? "" });
    setEditorOpen(true);
  }

  function confirmReject() {
    if (!rejectTarget) return;
    reviewMutation.mutate({
      id: rejectTarget.id,
      decision: "rejected",
      adminNotes: rejectReason.trim() || undefined,
    });
    setRejectTarget(null);
    setRejectReason("");
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data ?? [];
    if (!q) return list;
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.slug.includes(q),
    );
  }, [data, search]);

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <Breadcrumbs items={[{ label: "Admin", to: "/admin" }, { label: "Skills" }]} />
        <PageHeader
          eyebrow="Admin"
          title="Skill catalog"
          subtitle="Manage the skills candidates can assess and get verified on."
          actions={
            <Button
              className="gap-1 bg-gradient-brand text-primary-foreground hover:opacity-95"
              onClick={() => {
                setApprovingRequestId(null);
                setDraft(emptySkillDraft());
                setEditorOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> New skill
            </Button>
          }
        />

        {pendingRequests.length > 0 && (
          <div className="mt-8 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Pending skill requests ({pendingRequests.length})
            </h2>
            {pendingRequests.map((r) => (
              <div
                key={r.id}
                className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/40 dark:bg-amber-950/20"
              >
                <div>
                  <p className="font-medium text-foreground">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.userName}
                    {r.category ? ` · ${r.category}` : ""}
                    {r.notes ? ` · "${r.notes}"` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => approveRequest(r)}>
                    <Check className="h-4 w-4" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => setRejectTarget(r)}
                  >
                    <X className="h-4 w-4" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8">
          <SearchBar value={search} onChange={setSearch} placeholder="Search skills…" />
        </div>

        <div className="mt-6 space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <LoadingSkeleton key={i} className="h-20" />)
          ) : isError ? (
            <ErrorState
              title="Couldn't load the skill catalog"
              description="Please try again."
              onRetry={() => refetch()}
            />
          ) : filtered.length ? (
            filtered.map((s) => (
              <SkillRow
                key={s.id}
                skill={s}
                onEdit={() => {
                  setApprovingRequestId(null);
                  setDraft(skillDraftFrom(s));
                  setEditorOpen(true);
                }}
                onToggle={(isActive) => toggleMutation.mutate({ id: s.id, isActive })}
              />
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-border/70 bg-card p-10 text-center text-sm text-muted-foreground">
              No skills match your search.
            </p>
          )}
        </div>
      </main>

      <SkillEditorDialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) setApprovingRequestId(null);
        }}
        initial={draft}
        saving={saveMutation.isPending}
        onSave={(d) => saveMutation.mutate(d)}
      />

      <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject "{rejectTarget?.name}"?</DialogTitle>
            <DialogDescription>
              Let {rejectTarget?.userName} know why, so they can adjust and resubmit if needed.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason (optional)…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={reviewMutation.isPending}
            >
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardChrome>
  );
}

function SkillRow({
  skill,
  onEdit,
  onToggle,
}: {
  skill: AdminSkillRecord;
  onEdit: () => void;
  onToggle: (isActive: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <p className="font-semibold text-foreground">{skill.name}</p>
          <p className="text-xs text-muted-foreground">
            {skill.category} · {skill.difficulty} · {skill.slug}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={skill.isActive} onCheckedChange={onToggle} />
          <span className="text-xs text-muted-foreground">
            {skill.isActive ? "Active" : "Inactive"}
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={onEdit}>
          <FileEdit className="h-4 w-4" /> Edit
        </Button>
      </div>
    </div>
  );
}
