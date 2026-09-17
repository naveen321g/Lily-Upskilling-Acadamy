import { motion } from "motion/react";
import {
  ClipboardCheck,
  Sparkles,
  UserCheck,
  Fingerprint,
  BadgeCheck,
  Building2,
  type LucideIcon,
} from "lucide-react";

type Feature = { icon: LucideIcon; title: string; description: string };

const features: Feature[] = [
  {
    icon: ClipboardCheck,
    title: "Practical Assessments",
    description:
      "Real-world tasks and scenarios designed by industry experts — no memorization, only demonstrable skill.",
  },
  {
    icon: Sparkles,
    title: "AI Evaluation",
    description:
      "Advanced models score submissions in real time for accuracy, quality, and originality.",
  },
  {
    icon: UserCheck,
    title: "Expert Verification",
    description:
      "Every result is reviewed by domain experts to guarantee credibility and human judgment.",
  },
  {
    icon: Fingerprint,
    title: "Secure Identity Verification",
    description:
      "Multi-factor identity checks ensure the person tested is the person certified.",
  },
  {
    icon: BadgeCheck,
    title: "Digital Certificates",
    description:
      "Tamper-proof, shareable credentials with a public verification page and unique ID.",
  },
  {
    icon: Building2,
    title: "Employer Verification",
    description:
      "Employers instantly verify candidate credentials via our public API and partner portal.",
  },
];

export function Features() {
  return (
    <section id="features" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Platform</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            A verification stack built for <span className="text-gradient-brand">real trust</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            Six layers of technology and human review that turn skills into credentials employers
            recognize.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: (i % 3) * 0.08, duration: 0.5, ease: "easeOut" }}
              className="group relative overflow-hidden rounded-3xl border border-border/70 bg-card p-7 shadow-soft transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-elevated"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-40"
                style={{ background: "var(--gradient-brand)" }}
              />
              <div className="relative">
                <div className="inline-grid h-12 w-12 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-soft">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
