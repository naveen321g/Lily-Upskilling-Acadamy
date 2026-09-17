import { Link } from "@tanstack/react-router";
import { Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";

export function SkillsHeader({ onAddSkill }: { onAddSkill?: () => void }) {
  return (
    <PageHeader
      eyebrow="Skill Verification"
      title="My Skills"
      subtitle="Manage your verified skills, monitor your progress, and prepare for new assessments — all in one professional dashboard."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {onAddSkill && (
            <Button
              className="gap-1 bg-gradient-brand text-primary-foreground hover:opacity-95"
              onClick={onAddSkill}
            >
              <Plus className="h-4 w-4" />
              Add Skill
            </Button>
          )}
          <Button variant="outline" className="gap-1" asChild>
            <Link to="/certificates">
              <Upload className="h-4 w-4" />
              Upload Certificate
            </Link>
          </Button>
        </div>
      }
    />
  );
}
