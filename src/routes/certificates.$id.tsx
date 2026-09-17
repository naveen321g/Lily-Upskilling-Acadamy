import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  Award,
  BadgeCheck,
  Download,
  Share2,
  ShieldCheck,
  ArrowLeft,
  Printer,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { PublicCertificate } from "@/lib/certificate-shared";
import { formatDate } from "@/lib/format";
import logo from "@/assets/lua-logo.png";

async function fetchCertificate(code: string): Promise<PublicCertificate | null> {
  // No extra status/is_public filter here: RLS shows the owner their own
  // certificate at any status, and shows everyone else only approved+public ones.
  const { data } = await supabase
    .from("certificates")
    .select(
      "code, title, holder_name, score, level, skills, verifier, assessment_type, issued_at, expires_at",
    )
    .eq("code", code)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.code,
    title: data.title,
    holder: data.holder_name,
    issued: formatDate(data.issued_at) ?? "—",
    expires: formatDate(data.expires_at) ?? "—",
    score: data.score,
    level: data.level,
    skills: data.skills ?? [],
    verifier: data.verifier,
    assessmentType: data.assessment_type,
  };
}

export const Route = createFileRoute("/certificates/$id")({
  loader: async ({ params }) => {
    const cert = await fetchCertificate(params.id);
    if (!cert) throw notFound();
    return { cert };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.cert.title ?? "Certificate"} — LUA` },
      {
        name: "description",
        content: `Verified skill certificate ${loaderData?.cert.id} issued by Lily Upskilling Academy.`,
      },
      { property: "og:title", content: `${loaderData?.cert.title ?? "Certificate"} — LUA` },
      {
        property: "og:description",
        content: `Verified skill certificate issued by Lily Upskilling Academy.`,
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <p className="text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold">Certificate not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The certificate ID you followed doesn't exist or has been revoked.
        </p>
        <Button asChild className="mt-4">
          <Link to="/">Go home</Link>
        </Button>
      </div>
    </div>
  ),
  component: CertificatePage,
});

function CertificatePage() {
  const { cert } = Route.useLoaderData();
  const verifyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify/${cert.id}`
      : `/verify/${cert.id}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=${encodeURIComponent(
    verifyUrl,
  )}`;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="LUA" className="h-9 w-9" />
            <span className="font-display text-lg font-semibold">LUA</span>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" /> Back to dashboard
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Certificate</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{cert.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Download className="h-4 w-4" /> Download PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: cert.title, url: verifyUrl });
                } else {
                  navigator.clipboard.writeText(verifyUrl);
                }
              }}
            >
              <Share2 className="h-4 w-4" /> Share
            </Button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-border/70 bg-card p-8 shadow-elevated sm:p-12 print:shadow-none"
        >
          <div className="absolute inset-x-0 top-0 h-2 bg-gradient-brand" />
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-brand opacity-10 blur-3xl" />

          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <img src={logo} alt="LUA" className="h-12 w-12" />
              <div>
                <p className="font-display text-lg font-semibold">Lily Upskilling Academy</p>
                <p className="text-xs text-muted-foreground">Skill Verification Platform</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <BadgeCheck className="h-3.5 w-3.5" /> Verified · {cert.level}
            </span>
          </div>

          <div className="mt-10 text-center">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
              Certificate of skill verification
            </p>
            <p className="mt-6 text-sm text-muted-foreground">This is to certify that</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {cert.holder}
            </h2>
            <p className="mt-6 text-sm text-muted-foreground">has demonstrated proficiency in</p>
            <p className="mt-2 text-xl font-semibold text-foreground sm:text-2xl">{cert.title}</p>
            <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground">
              through {cert.assessmentType.toLowerCase()} assessment, reviewed and verified by the
              LUA expert panel with a final score of{" "}
              <span className="font-semibold text-foreground">{cert.score}%</span>.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            <Meta label="Issued" value={cert.issued} />
            <Meta label="Valid until" value={cert.expires} />
            <Meta label="Certificate ID" value={cert.id} />
          </div>

          <div className="mt-8">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Skills verified</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {cert.skills.map((s: string) => (
                <span
                  key={s}
                  className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-medium text-foreground"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-10 flex flex-col items-start justify-between gap-6 border-t border-border/60 pt-6 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Issued by</p>
              <p className="mt-1 text-sm font-semibold">{cert.verifier}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                Scan the QR or use the link below to verify authenticity.
              </p>
              <Link
                to="/verify/$id"
                params={{ id: cert.id }}
                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                <ShieldCheck className="h-4 w-4" /> Verify with employer
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
            <img
              src={qrSrc}
              alt={`Verify ${cert.id}`}
              width={140}
              height={140}
              className="h-32 w-32 rounded-lg border border-border/70 bg-background p-2"
            />
          </div>
        </motion.div>

        <div className="mt-6 rounded-2xl border border-border/70 bg-card p-5 shadow-soft print:hidden">
          <div className="flex items-start gap-3">
            <Award className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">Tamper-evident credential</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Each certificate is signed and can be validated at any time via the public
                verification page. Employers can confirm identity, score, and skill scope without
                contacting LUA support.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background p-4">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
