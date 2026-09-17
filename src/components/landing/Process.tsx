import { motion } from "motion/react";
import {
  UserPlus,
  ScanFace,
  Target,
  ClipboardCheck,
  Sparkles,
  UserCheck,
  BadgeCheck,
  Building2,
  type LucideIcon,
} from "lucide-react";

const steps: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: UserPlus, title: "Register", desc: "Create your professional profile." },
  { icon: ScanFace, title: "Identity Verification", desc: "Secure ID and biometric checks." },
  { icon: Target, title: "Choose Skill", desc: "Pick from 250+ verified skills." },
  { icon: ClipboardCheck, title: "Practical Assessment", desc: "Solve real-world tasks." },
  { icon: Sparkles, title: "AI Evaluation", desc: "Instant automated scoring." },
  { icon: UserCheck, title: "Expert Review", desc: "Human validation by pros." },
  { icon: BadgeCheck, title: "Digital Certificate", desc: "Shareable, verifiable proof." },
  { icon: Building2, title: "Employer Verification", desc: "Instant employer access." },
];

export function Process() {
  return (
    <section id="process" className="relative overflow-hidden bg-surface py-24 sm:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{ backgroundImage: "var(--gradient-radial-mint)" }}
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">How it works</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Eight steps to a <span className="text-gradient-brand">trusted credential</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            A rigorous, transparent path from sign-up to employer-ready certification.
          </p>
        </div>

        <div className="relative mt-16">
          {/* connecting line (desktop) */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent lg:block"
          />
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: (i % 4) * 0.08, duration: 0.5 }}
                className="relative"
              >
                <div className="relative z-10 mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-glow">
                  <s.icon className="h-7 w-7" />
                  <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full border-2 border-background bg-background text-[10px] font-bold text-primary">
                    {i + 1}
                  </span>
                </div>
                <div className="mt-5 rounded-2xl border border-border/70 bg-card p-5 text-center shadow-soft">
                  <h3 className="text-base font-semibold text-foreground">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
