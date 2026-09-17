import { SkillCard } from "./SkillCard";
import type { Skill } from "@/types/skill";

export function SkillGrid({
  skills,
  onRemove,
}: {
  skills: Skill[];
  onRemove?: (skill: Skill) => void;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {skills.map((s, i) => (
        <SkillCard key={s.id} skill={s} index={i} onRemove={onRemove && (() => onRemove(s))} />
      ))}
    </div>
  );
}
