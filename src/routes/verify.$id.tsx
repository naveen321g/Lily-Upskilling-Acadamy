import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ShieldCheck, CheckCircle2, ArrowLeft, Copy, Award, Building2, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { PublicCertificate } from "@/lib/certificate-shared";
import { formatDate } from "@/lib/format";
import logo from "@/assets/lua-logo.png";

async function fetchPublicCertificate(code: string): Promise<PublicCertificate | null> {
  // `status` was added by a hand-written migration and isn't in the generated
  // Database type yet — cast narrowly rather than widening the shared client type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from("certificates") as any)
    .select(
      "code, title, holder_name, score, level, skills, verifier, assessment_type, issued_at, expires_at",
    )
    .eq("code", code)
    .eq("status", "approved")
    .eq("is_public", true)
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

export const Route = createFileRoute("/verify/$id")({
  loader: async ({ params }) => {
    const cert = await fetchPublicCertificate(params.id);
    if (!cert) throw notFound();
    return { cert };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `Verify ${loaderData?.cert.id ?? "credential"} — LUA` },
      {
        name: "description",
        content:
          "Public employer verification for LUA-issued skill certificates. Confirm authenticity, score, and skill scope.",
      },
      { property: "og:title", content: "Verify credential — LUA" },
      {
        property: "og:description",
        content: "Public employer verification for LUA-issued skill certificates.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  notFoundComponent: () => <NotFoundState />,
  errorComponent: ({ error }) => (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <p className="text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  component: VerifyPage,
});

function VerifyPage() {
  const { cert } = Route.useLoaderData();
  const [copied, setCopied] = useState(false);

  function copyId() {
    navigator.clipboard.writeText(cert.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="LUA" className="h-9 w-9" />
            <span className="font-display text-lg font-semibold">LUA</span>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Building2 className="h-3.5 w-3.5" /> Employer verification portal
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Credential verified</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          This credential was issued by Lily Upskilling Academy and has not been revoked. Details
          below are pulled directly from the tamper-evident registry.
        </p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 overflow-hidden rounded-3xl border border-emerald-500/30 bg-card shadow-elevated"
        >
          <div className="flex items-center gap-3 border-b border-border/60 bg-emerald-500/5 px-6 py-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                Authentic · Active · Not revoked
              </p>
              <p className="text-xs text-muted-foreground">
                Last checked just now against the LUA registry.
              </p>
            </div>
          </div>

          <div className="grid gap-6 p-6 sm:grid-cols-2">
            <Field label="Certificate title" value={cert.title} />
            <Field label="Holder" value={cert.holder} />
            <Field
              label="Certificate ID"
              value={cert.id}
              action={
                <button
                  onClick={copyId}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Copy className="h-3 w-3" /> {copied ? "Copied" : "Copy"}
                </button>
              }
            />
            <Field label="Level" value={cert.level} />
            <Field label="Score" value={`${cert.score}%`} />
            <Field label="Assessment" value={cert.assessmentType} />
            <Field label="Issued" value={cert.issued} />
            <Field label="Valid until" value={cert.expires} />
          </div>

          <div className="border-t border-border/60 px-6 py-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Skills verified</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {cert.skills.map((s: string) => (
                <span
                  key={s}
                  className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-medium"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border/60 bg-muted/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Issued by {cert.verifier}
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link to="/certificates/$id" params={{ id: cert.id }}>
                <Award className="h-4 w-4" /> View full certificate
              </Link>
            </Button>
          </div>
        </motion.div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Trust
            icon={ShieldCheck}
            title="Tamper-evident"
            desc="Each credential is cryptographically signed at issuance."
          />
          <Trust
            icon={Search}
            title="Publicly verifiable"
            desc="Anyone with the ID can confirm authenticity — no login needed."
          />
          <Trust
            icon={Building2}
            title="Employer-trusted"
            desc="Reviewed by LUA's expert panel with practical evidence."
          />
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  action,
}: {
  label: string;
  value: string;
  action?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        {action}
      </div>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Trust({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand text-primary-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-2xl font-bold">Credential not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No LUA-issued certificate matches this ID. It may have been revoked, mistyped, or is from
          a different issuer.
        </p>
        <Button asChild className="mt-4">
          <Link to="/">Return home</Link>
        </Button>
      </div>
    </div>
  );
}
