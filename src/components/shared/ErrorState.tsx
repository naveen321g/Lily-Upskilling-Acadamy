import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shown when a query genuinely fails (network/server error) — distinct from
 * an empty-but-successful result, which uses EmptyState instead. Without
 * this, a failed fetch silently falls through to "you have nothing yet,"
 * which misrepresents the actual problem.
 */
export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this. Please try again.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center rounded-3xl border border-dashed border-red-200 bg-red-50/40 p-10 text-center dark:border-red-900/40 dark:bg-red-950/10">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      {onRetry && (
        <Button variant="outline" className="mt-5 gap-1" onClick={onRetry}>
          <RotateCw className="h-4 w-4" />
          Try again
        </Button>
      )}
    </div>
  );
}
