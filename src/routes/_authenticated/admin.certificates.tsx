import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, FileText, XCircle } from "lucide-react";
import { toast } from "sonner";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listPendingCertificateReviews, reviewCertificate } from "@/lib/certificate.functions";
import type { PendingCertificateReview } from "@/lib/certificate-shared";
import { formatDate } from "@/lib/format";
import { certificateState, statusMeta } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/admin/certificates")({
  head: () => ({
    meta: [
      { title: "Certificate review — LUA admin" },
      {
        name: "description",
        content: "Review and approve or reject candidate-uploaded certificates.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CertificateReviewPage,
});

const ALL = "all";

function CertificateReviewPage() {
  const fetchReviews = useServerFn(listPendingCertificateReviews);
  const review = useServerFn(reviewCertificate);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-certificate-reviews"],
    queryFn: () => fetchReviews(),
  });

  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [rejectTarget, setRejectTarget] = useState<PendingCertificateReview | null>(null);
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: (args: {
      certificateId: string;
      decision: "approved" | "rejected";
      notes?: string;
    }) => review({ data: args }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-certificate-reviews"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not update the certificate.");
    },
  });

  const filtered = useMemo(() => {
    const list = data ?? [];
    if (statusFilter === ALL) return list;
    return list.filter((r) => r.status === statusFilter);
  }, [data, statusFilter]);

  function approve(row: PendingCertificateReview) {
    mutation.mutate(
      { certificateId: row.id, decision: "approved" },
      { onSuccess: () => toast.success(`Approved ${row.title}.`) },
    );
  }

  function confirmReject() {
    if (!rejectTarget) return;
    mutation.mutate(
      { certificateId: rejectTarget.id, decision: "rejected", notes: notes.trim() || undefined },
      { onSuccess: () => toast.success(`Rejected ${rejectTarget.title}.`) },
    );
    setRejectTarget(null);
    setNotes("");
  }

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <Breadcrumbs items={[{ label: "Admin", to: "/admin" }, { label: "Certificates" }]} />
        <PageHeader
          eyebrow="Admin"
          title="Certificate review"
          subtitle="Approve or reject certificates candidates have uploaded as proof of a skill."
          actions={
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          }
        />

        <div className="mt-10 space-y-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <LoadingSkeleton key={i} className="h-28" />)
          ) : isError ? (
            <ErrorState
              title="Couldn't load certificates"
              description="Please try again."
              onRetry={() => refetch()}
            />
          ) : filtered.length ? (
            filtered.map((row) => {
              const status = statusMeta(certificateState(row.status));
              const StatusIcon = status.icon;
              return (
                <div
                  key={row.id}
                  className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{row.title}</p>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${status.className}`}
                      >
                        <StatusIcon className="h-3 w-3" /> {status.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.skillName} · {row.holderName} · Submitted{" "}
                      {formatDate(row.createdAt) ?? "—"}
                    </p>
                    {row.reviewNotes && (
                      <p className="mt-1 text-xs italic text-muted-foreground">
                        Note: {row.reviewNotes}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {row.fileUrl && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={row.fileUrl} target="_blank" rel="noreferrer">
                          <FileText className="h-4 w-4" /> View file
                        </a>
                      </Button>
                    )}
                    {row.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => setRejectTarget(row)}
                          disabled={mutation.isPending}
                        >
                          <XCircle className="h-4 w-4" /> Reject
                        </Button>
                        <Button
                          size="sm"
                          className="bg-gradient-brand text-primary-foreground hover:opacity-95"
                          onClick={() => approve(row)}
                          disabled={mutation.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4" /> Approve
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="rounded-2xl border border-dashed border-border/70 bg-card p-10 text-center text-sm text-muted-foreground">
              No certificates in this view.
            </p>
          )}
        </div>
      </main>

      <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject certificate</DialogTitle>
            <DialogDescription>
              Let {rejectTarget?.holderName} know why "{rejectTarget?.title}" was rejected.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. The uploaded file is illegible — please re-upload a clearer scan."
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmReject} disabled={mutation.isPending}>
              Reject certificate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardChrome>
  );
}
