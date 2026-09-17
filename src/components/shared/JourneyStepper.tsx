import { Check } from "lucide-react";

export type StepState = "done" | "current" | "upcoming";

export type JourneyStep = {
  label: string;
  state: StepState;
};

export function JourneyStepper({ steps }: { steps: JourneyStep[] }) {
  return (
    <ol className="flex items-start" aria-label="Progress">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <li key={step.label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5 text-center">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                  step.state === "done"
                    ? "bg-gradient-brand text-primary-foreground"
                    : step.state === "current"
                      ? "border-2 border-primary bg-primary/10 text-primary"
                      : "border border-border bg-muted text-muted-foreground"
                }`}
                aria-current={step.state === "current" ? "step" : undefined}
              >
                {step.state === "done" ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span
                className={`max-w-[6.5rem] text-[11px] leading-tight ${
                  step.state === "upcoming"
                    ? "text-muted-foreground"
                    : "font-medium text-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={`mx-1 mt-3.5 h-0.5 flex-1 rounded-full ${
                  step.state === "done" ? "bg-gradient-brand" : "bg-border"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
