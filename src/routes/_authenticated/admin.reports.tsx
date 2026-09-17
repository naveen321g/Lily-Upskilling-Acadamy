import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Award, CalendarClock, Download, Gem, ShieldAlert, Users } from "lucide-react";
import { toast } from "sonner";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { listAllCertificatesAdmin } from "@/lib/certificate.functions";
import { listBadges } from "@/lib/badges.functions";
import { listUsers } from "@/lib/users.functions";
import { getActivityReport } from "@/lib/admin.functions";
import { getFraudSignals } from "@/lib/fraud.functions";
import { toCsv, downloadCsv } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({
    meta: [
      { title: "Reports — LUA admin" },
      {
        name: "description",
        content: "Download CSV reports on certificates, verifications and user activity.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsAdminPage,
});

function ReportsAdminPage() {
  const fetchCertificates = useServerFn(listAllCertificatesAdmin);
  const fetchBadges = useServerFn(listBadges);
  const fetchUsers = useServerFn(listUsers);
  const fetchActivity = useServerFn(getActivityReport);
  const fetchFraud = useServerFn(getFraudSignals);
  const [pending, setPending] = useState<string | null>(null);

  async function exportCertificates() {
    setPending("certificates");
    try {
      const rows = await fetchCertificates();
      const csv = toCsv(rows, [
        { key: "code", header: "Code" },
        { key: "title", header: "Title" },
        { key: "skillName", header: "Skill" },
        { key: "holderName", header: "Holder" },
        { key: "source", header: "Source" },
        { key: "status", header: "Status" },
        { key: "score", header: "Score" },
        { key: "issuedAt", header: "Issued at" },
      ]);
      downloadCsv(`certificates-${Date.now()}.csv`, csv);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not build report.");
    } finally {
      setPending(null);
    }
  }

  async function exportBadges() {
    setPending("badges");
    try {
      const rows = await fetchBadges();
      const csv = toCsv(rows, [
        { key: "userName", header: "Candidate" },
        { key: "skillName", header: "Skill" },
        { key: "type", header: "Badge type" },
        { key: "status", header: "Status" },
        { key: "issuedAt", header: "Issued at" },
        { key: "revokedAt", header: "Revoked at" },
        { key: "revokeReason", header: "Revoke reason" },
      ]);
      downloadCsv(`verifications-${Date.now()}.csv`, csv);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not build report.");
    } finally {
      setPending(null);
    }
  }

  async function exportUsers() {
    setPending("users");
    try {
      const rows = await fetchUsers({ data: {} });
      const csv = toCsv(rows, [
        { key: "email", header: "Email" },
        { key: "fullName", header: "Name" },
        { key: "createdAt", header: "Joined" },
        { key: "skillsVerified", header: "Skills verified" },
        { key: "attemptsCount", header: "Assessment attempts" },
        { key: "certificatesCount", header: "Certificates" },
        { key: "bannedUntil", header: "Suspended until" },
      ]);
      downloadCsv(`user-activity-${Date.now()}.csv`, csv);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not build report.");
    } finally {
      setPending(null);
    }
  }

  async function exportActivity(period: "daily" | "weekly" | "monthly") {
    setPending(`activity-${period}`);
    try {
      const rows = await fetchActivity({ data: { period } });
      const csv = toCsv(rows, [
        { key: "metric", header: "Metric" },
        { key: "count", header: "Count" },
      ]);
      downloadCsv(`${period}-activity-${Date.now()}.csv`, csv);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not build report.");
    } finally {
      setPending(null);
    }
  }

  async function exportFraud() {
    setPending("fraud");
    try {
      const signals = await fetchFraud();
      const rows = [
        ...signals.duplicateCertificates.map((s) => ({
          type: "Duplicate certificate",
          userName: s.userName,
          skillName: s.skillName,
          count: s.count,
        })),
        ...signals.repeatedFailures.map((s) => ({
          type: "Repeated failed attempts",
          userName: s.userName,
          skillName: s.skillName,
          count: s.failedCount,
        })),
      ];
      const csv = toCsv(rows, [
        { key: "type", header: "Signal" },
        { key: "userName", header: "Candidate" },
        { key: "skillName", header: "Skill" },
        { key: "count", header: "Count" },
      ]);
      downloadCsv(`fraud-report-${Date.now()}.csv`, csv);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not build report.");
    } finally {
      setPending(null);
    }
  }

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <Breadcrumbs items={[{ label: "Admin", to: "/admin" }, { label: "Reports" }]} />
        <PageHeader
          eyebrow="Admin"
          title="Reports"
          subtitle="Download CSV exports of current platform data."
        />

        <div className="mt-8 space-y-4">
          <ReportCard
            icon={Award}
            title="Certificates report"
            description="Every certificate — AI-issued and uploaded — with status, score and skill."
            onExport={exportCertificates}
            loading={pending === "certificates"}
          />
          <ReportCard
            icon={Gem}
            title="Verification report"
            description="Every badge issued, its current status, and any revocation reason."
            onExport={exportBadges}
            loading={pending === "badges"}
          />
          <ReportCard
            icon={Users}
            title="User activity report"
            description="Every candidate with join date, verified-skill count, attempts and certificates."
            onExport={exportUsers}
            loading={pending === "users"}
          />
          <ReportCard
            icon={ShieldAlert}
            title="Fraud report"
            description="Duplicate certificate uploads and repeated failed attempts flagged by the fraud dashboard."
            onExport={exportFraud}
            loading={pending === "fraud"}
          />

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-brand text-primary-foreground">
                <CalendarClock className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Activity report</p>
                <p className="text-xs text-muted-foreground">
                  New candidates, assessments, certificates, badges and tickets for a period.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["daily", "weekly", "monthly"] as const).map((period) => (
                <Button
                  key={period}
                  size="sm"
                  variant="outline"
                  onClick={() => exportActivity(period)}
                  disabled={pending === `activity-${period}`}
                >
                  <Download className="h-4 w-4" />
                  {pending === `activity-${period}`
                    ? "Preparing…"
                    : period.charAt(0).toUpperCase() + period.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </DashboardChrome>
  );
}

function ReportCard({
  icon: Icon,
  title,
  description,
  onExport,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onExport: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-brand text-primary-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button size="sm" onClick={onExport} disabled={loading}>
        <Download className="h-4 w-4" /> {loading ? "Preparing…" : "Export CSV"}
      </Button>
    </div>
  );
}
