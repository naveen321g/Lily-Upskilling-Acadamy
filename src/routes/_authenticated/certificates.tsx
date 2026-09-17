import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { Award, ExternalLink, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { JourneyStepper, type JourneyStep } from "@/components/shared/JourneyStepper";
import { EmptyState } from "@/components/skills/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { listSkillCatalog } from "@/lib/assessment.functions";
import { listMyCertificates, submitCertificateUpload } from "@/lib/certificate.functions";
import {
  ACCEPTED_CERTIFICATE_TYPES,
  MAX_CERTIFICATE_FILE_BYTES,
  type CertificateSummary,
} from "@/lib/certificate-shared";
import { formatDate } from "@/lib/format";
import { certificateState, statusMeta } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/certificates")({
  head: () => ({
    meta: [
      { title: "Certificates — LUA" },
      {
        name: "description",
        content:
          "View your AI-issued and uploaded certificates, and submit a certificate for manual review.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CertificatesPage,
});

function CertificatesPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const fetchCertificates = useServerFn(listMyCertificates);
  const fetchSkills = useServerFn(listSkillCatalog);
  const submitUpload = useServerFn(submitCertificateUpload);

  const {
    data: certificates,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["my-certificates"],
    queryFn: () => fetchCertificates(),
  });
  const { data: skills } = useQuery({
    queryKey: ["skill-catalog"],
    queryFn: () => fetchSkills(),
  });

  const [open, setOpen] = useState(false);
  const [skillId, setSkillId] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setSkillId("");
    setTitle("");
    setFile(null);
  }

  async function handleUpload() {
    if (!skillId) return toast.error("Choose the skill this certificate proves.");
    if (!title.trim()) return toast.error("Give the certificate a title.");
    if (!file) return toast.error("Choose a PDF or image file to upload.");
    if (!ACCEPTED_CERTIFICATE_TYPES.includes(file.type))
      return toast.error("Only PDF, PNG or JPG files are accepted.");
    if (file.size > MAX_CERTIFICATE_FILE_BYTES) return toast.error("File is too large. Max 10MB.");

    setSubmitting(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("certificates")
        .upload(path, file, {
          contentType: file.type,
        });
      if (uploadError) throw uploadError;

      await submitUpload({ data: { skillId, title: title.trim(), filePath: path } });
      toast.success("Certificate submitted for review.");
      setOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["my-certificates"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload certificate.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <Breadcrumbs
          items={[{ label: "Dashboard", to: "/dashboard" }, { label: "Certificates" }]}
        />
        <PageHeader
          eyebrow="Certificate Verification"
          title="My Certificates"
          subtitle="AI-issued certificates from passed expert assessments, plus any certificates you've uploaded for manual review."
          actions={
            <Dialog
              open={open}
              onOpenChange={(next) => {
                setOpen(next);
                if (!next) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button className="gap-1 bg-gradient-brand text-primary-foreground hover:opacity-95">
                  <Upload className="h-4 w-4" />
                  Upload Certificate
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload a certificate</DialogTitle>
                  <DialogDescription>
                    Submit proof of a skill for manual review by the LUA team. You'll earn the
                    "Certification Verified" badge once it's approved.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Skill</Label>
                    <Select value={skillId} onValueChange={setSkillId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a skill" />
                      </SelectTrigger>
                      <SelectContent>
                        {(skills ?? []).map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cert-title">Certificate title</Label>
                    <Input
                      id="cert-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. AWS Certified Solutions Architect"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cert-file">File (PDF, PNG or JPG, max 10MB)</Label>
                    <Input
                      id="cert-file"
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleUpload} disabled={submitting} className="w-full">
                    {submitting ? "Uploading…" : "Submit for review"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          }
        />

        <div className="mt-10">
          {isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <LoadingSkeleton key={i} className="h-40" />
              ))}
            </div>
          ) : isError ? (
            <ErrorState
              title="Couldn't load your certificates"
              description="Please try again."
              onRetry={() => refetch()}
            />
          ) : certificates?.length ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {certificates.map((c, i) => (
                <CertificateCard key={c.id} certificate={c} index={i} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No certificates yet"
              description="Pass an expert assessment to earn an AI-issued certificate, or upload one of your own for manual review."
              actionLabel="Upload Certificate"
              onAction={() => setOpen(true)}
            />
          )}
        </div>
      </main>
    </DashboardChrome>
  );
}

function CertificateCard({
  certificate: c,
  index,
}: {
  certificate: CertificateSummary;
  index: number;
}) {
  const status = statusMeta(certificateState(c.status));
  const StatusIcon = status.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (index % 6) * 0.05, duration: 0.4 }}
      className="rounded-2xl border border-border/70 bg-card p-6 shadow-soft"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-brand text-primary-foreground shadow-soft">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-foreground">{c.title}</p>
            <p className="text-xs text-muted-foreground">{c.skillName}</p>
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ring-1 ring-inset ${status.className}`}
        >
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </span>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {c.source === "ai" ? "AI-issued" : "Uploaded"} · {formatDate(c.issuedAt) ?? "—"}
        {c.source === "ai" && ` · Score ${c.score}%`}
      </p>

      {c.source === "upload" && c.status !== "rejected" && (
        <div className="mt-4">
          <JourneyStepper
            steps={
              [
                { label: "Upload", state: "done" },
                { label: "Admin Review", state: c.status === "pending" ? "current" : "done" },
                { label: "Verified", state: c.status === "pending" ? "upcoming" : "done" },
              ] satisfies JourneyStep[]
            }
          />
        </div>
      )}

      {c.status === "rejected" && c.reviewNotes && (
        <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{c.reviewNotes}</p>
      )}

      {c.status === "approved" && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-4">
          <Button size="sm" variant="outline" asChild>
            <Link to="/verify/$id" params={{ id: c.code }}>
              <ShieldCheck className="h-4 w-4" /> Verify
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/certificates/$id" params={{ id: c.code }}>
              <ExternalLink className="h-4 w-4" /> View
            </Link>
          </Button>
        </div>
      )}
    </motion.div>
  );
}
