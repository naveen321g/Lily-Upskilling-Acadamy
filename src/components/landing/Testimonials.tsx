import { motion } from "motion/react";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Amara Okafor",
    role: "Software Engineer · Candidate",
    initials: "AO",
    quote:
      "LUA's verification made my portfolio credible. Recruiters trusted my certificate instantly and I landed interviews within a week.",
  },
  {
    name: "David Chen",
    role: "Head of Talent · TechCorp",
    initials: "DC",
    quote:
      "We use LUA to shortlist candidates. The combination of AI scoring and expert review cuts our hiring time in half.",
  },
  {
    name: "Priya Sharma",
    role: "Cybersecurity Expert · Reviewer",
    initials: "PS",
    quote:
      "As a reviewer, I appreciate the rigor. Every submission goes through practical, real-world evaluation — no shortcuts.",
  },
];

export function Testimonials() {
  return (
    <section className="relative bg-surface py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Testimonials</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Trusted by candidates, <span className="text-gradient-brand">employers, and experts</span>
          </h2>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.figure
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="flex h-full flex-col rounded-3xl border border-border/70 bg-card p-7 shadow-soft transition-all hover:-translate-y-1 hover:shadow-elevated"
            >
              <div className="flex items-center gap-1 text-primary">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-foreground/90">
                "{t.quote}"
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t border-border/60 pt-4">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-brand text-sm font-semibold text-primary-foreground">
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
