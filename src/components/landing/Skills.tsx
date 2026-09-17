import { motion } from "motion/react";
import { skillIcon } from "@/lib/skill-icons";

type Skill = {
  iconKey: string;
  name: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  assessments: number;
};

// Real catalog skills (matching what candidates actually see on the AI
// Interview / Assessments pages) — not generic placeholder tech skills, so
// the landing page reflects what LUA actually verifies.
const skills: Skill[] = [
  { iconKey: "Zap", name: "Electrician", level: "Intermediate", assessments: 24 },
  { iconKey: "Wrench", name: "Plumbing", level: "Intermediate", assessments: 20 },
  { iconKey: "Camera", name: "Photography", level: "Intermediate", assessments: 18 },
  { iconKey: "ChefHat", name: "Cooking", level: "Intermediate", assessments: 22 },
  { iconKey: "Smartphone", name: "App Development", level: "Advanced", assessments: 30 },
  { iconKey: "Shield", name: "Cybersecurity", level: "Advanced", assessments: 26 },
  { iconKey: "Dumbbell", name: "Fitness Training", level: "Intermediate", assessments: 16 },
  { iconKey: "Brush", name: "Makeup Artist", level: "Intermediate", assessments: 14 },
  { iconKey: "Snowflake", name: "AC Servicing", level: "Intermediate", assessments: 19 },
  { iconKey: "Megaphone", name: "Digital Marketing", level: "Beginner", assessments: 21 },
];

const levelColor: Record<Skill["level"], string> = {
  Beginner: "bg-mint/30 text-mint-foreground",
  Intermediate: "bg-teal-soft/20 text-primary",
  Advanced: "bg-primary/10 text-primary",
};

export function Skills() {
  return (
    <section id="skills" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Skills</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Verify what you can <span className="text-gradient-brand">actually do</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            From foundational to advanced — a growing catalog of practical, employer-mapped skills.
          </p>
        </div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {skills.map((s, i) => {
            const Icon = skillIcon(s.iconKey);
            return (
              <motion.div
                key={s.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: (i % 5) * 0.06, duration: 0.45 }}
                className="group cursor-pointer rounded-2xl border border-border/70 bg-card p-5 shadow-soft transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-elevated"
              >
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-brand text-primary-foreground transition-transform group-hover:scale-110">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">{s.name}</h3>
                <div className="mt-3 flex items-center justify-between">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${levelColor[s.level]}`}
                  >
                    {s.level}
                  </span>
                  <span className="text-xs text-muted-foreground">{s.assessments} tests</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
