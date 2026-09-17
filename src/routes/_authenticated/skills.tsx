import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Clock, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { SkillsHeader } from "@/components/skills/SkillsHeader";
import { SkillsOverview } from "@/components/skills/SkillsOverview";
import { SkillFilters, DEFAULT_FILTERS, type FilterState } from "@/components/skills/SkillFilters";
import { SkillGrid } from "@/components/skills/SkillGrid";
import { EmptyState } from "@/components/skills/EmptyState";
import { AddSkillDialog } from "@/components/skills/AddSkillDialog";
import { SearchBar } from "@/components/shared/SearchBar";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  addMySkill,
  listMySkillRequests,
  listMySkills,
  removeMySkill,
  requestNewSkill,
} from "@/lib/skills.functions";
import { listSkillCatalog } from "@/lib/assessment.functions";
import { listMyCertificates } from "@/lib/certificate.functions";
import { skillIcon } from "@/lib/skill-icons";
import { formatDate } from "@/lib/format";
import { skillCta, statusMeta } from "@/lib/status";
import { verificationRowFor, type VerificationRow } from "@/lib/verification-status";
import type { Skill } from "@/types/skill";

export const Route = createFileRoute("/_authenticated/skills")({
  head: () => ({
    meta: [
      { title: "My Skills — LUA" },
      {
        name: "description",
        content:
          "Manage your verified skills, monitor progress, and start new assessments on Lily Upskilling Academy.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SkillsPage,
});

function SkillsPage() {
  const queryClient = useQueryClient();
  const fetchMySkills = useServerFn(listMySkills);
  const fetchCatalog = useServerFn(listSkillCatalog);
  const fetchMyRequests = useServerFn(listMySkillRequests);
  const fetchCertificates = useServerFn(listMyCertificates);
  const addSkill = useServerFn(addMySkill);
  const removeSkill = useServerFn(removeMySkill);
  const submitRequest = useServerFn(requestNewSkill);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-skills"],
    queryFn: () => fetchMySkills(),
  });
  const { data: catalog } = useQuery({
    queryKey: ["skill-catalog"],
    queryFn: () => fetchCatalog(),
  });
  const { data: myRequests } = useQuery({
    queryKey: ["my-skill-requests"],
    queryFn: () => fetchMyRequests(),
  });
  const { data: certificates } = useQuery({
    queryKey: ["my-certificates"],
    queryFn: () => fetchCertificates(),
  });

  const verificationRows = useMemo(
    () => (data ?? []).map((s) => verificationRowFor(s, certificates ?? [])),
    [data, certificates],
  );
  const needsAttention = verificationRows.filter((r) => !r.fullyVerified);
  const verifiedCount = verificationRows.length - needsAttention.length;

  const skills = useMemo<Skill[]>(
    () =>
      (data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        icon: skillIcon(s.iconKey),
        category: s.category,
        difficulty: s.difficulty,
        completion: s.completion,
        score: s.score,
        status: s.status,
        verifications: s.verifications,
        issued: formatDate(s.issuedAt),
        expires: formatDate(s.expiresAt),
        trust: s.trust,
        certificateCode: s.certificateCode,
        progress: s.progress,
      })),
    [data],
  );

  const [addOpen, setAddOpen] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Skill | null>(null);

  const addMutation = useMutation({
    mutationFn: (skillId: string) => {
      setAddingId(skillId);
      return addSkill({ data: { skillId } });
    },
    onSuccess: () => {
      toast.success("Skill added to your profile.");
      queryClient.invalidateQueries({ queryKey: ["my-skills"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not add skill."),
    onSettled: () => setAddingId(null),
  });

  const removeMutation = useMutation({
    mutationFn: (skillId: string) => removeSkill({ data: { skillId } }),
    onSuccess: () => {
      toast.success("Skill removed from your profile.");
      queryClient.invalidateQueries({ queryKey: ["my-skills"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not remove skill."),
    onSettled: () => setRemoveTarget(null),
  });

  const requestMutation = useMutation({
    mutationFn: (input: { name: string; category?: string; notes?: string }) =>
      submitRequest({ data: input }),
    onSuccess: () => {
      toast.success("Skill request submitted for review.");
      queryClient.invalidateQueries({ queryKey: ["my-skill-requests"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not submit skill request."),
  });

  const pendingOrRejectedRequests = (myRequests ?? []).filter((r) => r.status !== "approved");

  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const filtered = useMemo(() => {
    let list = [...skills];
    const q = query.trim().toLowerCase();
    if (q)
      list = list.filter(
        (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q),
      );
    if (filters.status !== "all") list = list.filter((s) => s.status === filters.status);
    if (filters.verification !== "all")
      list = list.filter((s) => s.verifications.includes(filters.verification as never));
    if (filters.difficulty !== "all")
      list = list.filter((s) => s.difficulty === filters.difficulty);
    if (filters.category !== "all") list = list.filter((s) => s.category === filters.category);

    switch (filters.sort) {
      case "score":
        list.sort((a, b) => b.score - a.score);
        break;
      case "alpha":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "oldest":
        list.reverse();
        break;
      default:
        break;
    }
    return list;
  }, [skills, query, filters]);

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <SkillsHeader onAddSkill={() => setAddOpen(true)} />

        {!isLoading && !isError && verificationRows.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-3xl border border-border/70 bg-card p-6 shadow-soft sm:p-8"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Verification progress
                </p>
                <p className="mt-2 text-xl font-bold tracking-tight text-foreground">
                  {verifiedCount} of {verificationRows.length} skills fully verified
                </p>
              </div>
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-soft">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.round((verifiedCount / verificationRows.length) * 100)}%`,
                }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-brand"
              />
            </div>

            {needsAttention.length > 0 && (
              <div className="mt-6 space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Needs your attention ({needsAttention.length})
                </h2>
                {needsAttention.map((row) => (
                  <AttentionRow key={row.skill.id} row={row} />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {pendingOrRejectedRequests.length > 0 && (
          <div className="mt-6 space-y-2">
            {pendingOrRejectedRequests.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 text-sm"
              >
                {r.status === "pending" ? (
                  <Clock className="h-4 w-4 shrink-0 text-amber-500" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                )}
                <span className="text-foreground">
                  Skill request "{r.name}" —{" "}
                  {r.status === "pending" ? "awaiting review" : "not approved"}
                </span>
                {r.adminNotes && (
                  <span className="text-xs text-muted-foreground">— {r.adminNotes}</span>
                )}
              </div>
            ))}
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4 }}
          className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center"
        >
          <div className="flex-1">
            <SearchBar value={query} onChange={setQuery} />
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-4 py-2 text-xs text-muted-foreground shadow-soft">
            <BadgeCheck className="h-4 w-4 text-primary" />
            Showing <span className="font-semibold text-foreground">{filtered.length}</span> of{" "}
            {skills.length}
          </div>
        </motion.div>

        <div className="mt-6">
          <SkillFilters filters={filters} setFilters={setFilters} />
        </div>

        {isLoading ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <LoadingSkeleton key={i} className="h-32" />
            ))}
          </div>
        ) : isError ? (
          <div className="mt-10">
            <ErrorState
              title="Couldn't load your skills"
              description="We couldn't load your skill portfolio. Please try again."
              onRetry={() => refetch()}
            />
          </div>
        ) : (
          <>
            <section aria-labelledby="overview" className="mt-10">
              <h2 id="overview" className="sr-only">
                Overview
              </h2>
              <SkillsOverview skills={skills} />
            </section>

            <section aria-labelledby="grid" className="mt-12">
              <div className="mb-6 flex items-end justify-between">
                <h2
                  id="grid"
                  className="font-display text-xl font-semibold tracking-tight sm:text-2xl"
                >
                  Your skill portfolio
                </h2>
              </div>
              {filtered.length ? (
                <SkillGrid skills={filtered} onRemove={(s) => setRemoveTarget(s)} />
              ) : skills.length ? (
                <EmptyState
                  title="No skills match your filters"
                  description="Try clearing filters or add another skill to your portfolio."
                  actionLabel="Reset filters"
                  onAction={() => {
                    setQuery("");
                    setFilters(DEFAULT_FILTERS);
                  }}
                />
              ) : (
                <EmptyState
                  title="No skills yet"
                  description="Add a skill to your profile to start tracking and verifying it."
                  actionLabel="Add Skill"
                  onAction={() => setAddOpen(true)}
                />
              )}
            </section>
          </>
        )}
      </main>

      <AddSkillDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        catalog={catalog ?? []}
        addedIds={new Set(skills.map((s) => s.id))}
        onAdd={(skillId) => addMutation.mutate(skillId)}
        addingId={addingId}
        onRequestNew={(input) => requestMutation.mutate(input)}
        requesting={requestMutation.isPending}
      />

      <Dialog open={Boolean(removeTarget)} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removeTarget?.name}?</DialogTitle>
            <DialogDescription>
              This removes it from your skill portfolio. Any certificates or badges you've already
              earned for it stay valid — you can add it back any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={removeMutation.isPending}
              onClick={() => removeTarget && removeMutation.mutate(removeTarget.id)}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardChrome>
  );
}

function AttentionRow({ row }: { row: VerificationRow }) {
  const { skill, state, message, detail } = row;
  const Icon = skillIcon(skill.iconKey);
  const status = statusMeta(state);
  const StatusIcon = status.icon;
  const cta = skillCta(skill);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="font-semibold text-foreground">{skill.name}</p>
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <StatusIcon className="h-3.5 w-3.5" />
            {message}
          </p>
          {detail && <p className="mt-1 text-xs text-muted-foreground">"{detail}"</p>}
        </div>
      </div>
      <Button size="sm" className="shrink-0" asChild>
        <Link to={cta.to} params={cta.params}>
          {cta.label}
        </Link>
      </Button>
    </div>
  );
}
