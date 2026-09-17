import { motion } from "motion/react";
import { ChevronRight, Star, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { VerificationBadges } from "./VerificationBadges";
import type { Skill } from "@/types/skill";
import { skillCta, skillState, statusMeta } from "@/lib/status";

const DIFFICULTY_STARS: Record<Skill["difficulty"], number> = {
  Beginner: 2,
  Intermediate: 3,
  Advanced: 4,
  Expert: 5,
};

export function SkillCard({
  skill,
  index = 0,
  onRemove,
}: {
  skill: Skill;
  index?: number;
  onRemove?: () => void;
}) {
  const status = statusMeta(skillState(skill.status, skill.completion, skill.score));
  const StatusIcon = status.icon;
  const cta = skillCta(skill);
  const Icon = skill.icon;
  const stars = DIFFICULTY_STARS[skill.difficulty];

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: (index % 6) * 0.05 }}
      whileHover={{ y: -4 }}
      className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border/70 bg-card p-6 shadow-soft transition-all hover:border-primary/40 hover:shadow-elevated"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-radial-mint opacity-0 transition-opacity group-hover:opacity-100" />

      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-soft">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold leading-tight text-foreground">
              {skill.name}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{skill.category}</p>
            <div
              className="mt-1.5 flex items-center gap-0.5"
              aria-label={`Difficulty: ${skill.difficulty}`}
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-3 w-3 ${i < stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
                />
              ))}
              <span className="ml-1.5 text-[11px] text-muted-foreground">{skill.difficulty}</span>
            </div>
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ring-1 ring-inset ${status.className}`}
        >
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </span>
      </header>

      <div className="mt-5 space-y-3">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Completion</span>
            <span className="font-semibold text-foreground">{skill.completion}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${skill.completion}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-brand"
            />
          </div>
        </div>

        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Score</p>
          <p className="text-lg font-bold text-foreground">{skill.score}%</p>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            Verifications
          </p>
          {skill.verifications.length ? (
            <VerificationBadges types={skill.verifications} />
          ) : (
            <span className="text-xs italic text-muted-foreground">No verifications yet</span>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Issued: {skill.issued ?? "—"}</span>
          <span>Expires: {skill.expires ?? "—"}</span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
        <Button size="sm" variant="outline" className="gap-1" asChild>
          <Link to="/skills/$id" params={{ id: skill.id }}>
            <ChevronRight className="h-4 w-4" />
            View Details
          </Link>
        </Button>
        <Button
          size="sm"
          className="gap-1 bg-gradient-brand text-primary-foreground hover:opacity-95"
          asChild
        >
          <Link to={cta.to} params={cta.params}>
            {cta.label}
          </Link>
        </Button>
        {onRemove && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto gap-1 text-muted-foreground hover:text-red-600"
            onClick={onRemove}
          >
            <X className="h-4 w-4" />
            Remove
          </Button>
        )}
      </div>
    </motion.article>
  );
}
