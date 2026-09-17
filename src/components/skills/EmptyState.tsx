import { motion } from "motion/react";
import { Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title = "No skills to show",
  description = "Start your skill verification journey today.",
  actionLabel = "Add Your First Skill",
  onAction,
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex max-w-lg flex-col items-center rounded-3xl border border-dashed border-border/80 bg-surface p-10 text-center shadow-soft"
    >
      <div className="relative grid h-20 w-20 place-items-center rounded-3xl bg-gradient-brand text-primary-foreground shadow-glow">
        <Sparkles className="h-9 w-9" />
        <span className="absolute inset-0 animate-ping rounded-3xl bg-primary/20" />
      </div>
      <h3 className="mt-6 font-display text-xl font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <Button className="mt-6 gap-1 bg-gradient-brand text-primary-foreground hover:opacity-95" onClick={onAction}>
        <Plus className="h-4 w-4" />
        {actionLabel}
      </Button>
    </motion.div>
  );
}
