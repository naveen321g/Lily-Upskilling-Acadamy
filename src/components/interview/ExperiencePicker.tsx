import { Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InterviewExperienceLevel } from "@/lib/interview-shared";

export function ExperiencePicker({
  onChoose,
  disabled,
}: {
  onChoose: (level: InterviewExperienceLevel) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={disabled} onClick={() => onChoose("beginner")}>
        <Sparkles className="h-4 w-4" /> New to this skill
      </Button>
      <Button disabled={disabled} onClick={() => onChoose("experienced")}>
        <Trophy className="h-4 w-4" /> I have real experience
      </Button>
    </div>
  );
}
