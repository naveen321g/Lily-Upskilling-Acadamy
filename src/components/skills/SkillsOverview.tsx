import { motion } from "motion/react";
import { Layers, BadgeCheck, Clock, AlertTriangle, Gauge, type LucideIcon } from "lucide-react";
import type { Skill } from "@/types/skill";

type Stat = {
  label: string;
  value: string;
  icon: LucideIcon;
  accent: string;
};

export function SkillsOverview({ skills }: { skills: Skill[] }) {
  const total = skills.length;
  const verified = skills.filter((s) => s.status === "verified").length;
  const pending = skills.filter((s) => s.status === "pending").length;
  const expired = skills.filter((s) => s.status === "expired" || s.status === "failed").length;
  const avgScore = skills.length
    ? Math.round(skills.reduce((a, s) => a + s.score, 0) / skills.length)
    : 0;

  const stats: Stat[] = [
    {
      label: "Total Skills",
      value: `${total}`,
      icon: Layers,
      accent: "from-primary/15 to-primary/0",
    },
    {
      label: "Verified",
      value: `${verified}`,
      icon: BadgeCheck,
      accent: "from-emerald-500/20 to-emerald-500/0",
    },
    {
      label: "Pending",
      value: `${pending}`,
      icon: Clock,
      accent: "from-amber-500/20 to-amber-500/0",
    },
    {
      label: "Expired",
      value: `${expired}`,
      icon: AlertTriangle,
      accent: "from-red-500/20 to-red-500/0",
    },
    {
      label: "Average Score",
      value: `${avgScore}%`,
      icon: Gauge,
      accent: "from-sky-500/20 to-sky-500/0",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {stats.map((s, i) => {
        const Icon = s.icon;
        return (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4 }}
            whileHover={{ y: -3 }}
            className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-soft transition-all hover:shadow-elevated"
          >
            <div
              className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${s.accent} opacity-60`}
            />
            <div className="relative">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-card ring-1 ring-border/70 shadow-soft">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <p className="mt-4 text-2xl font-bold tracking-tight text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
