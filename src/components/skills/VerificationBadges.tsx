import { Sparkles, UserCheck, Building2, Award, Gem } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { VerificationType } from "@/types/skill";

const MAP: Record<
  VerificationType | "diamond",
  { label: string; description: string; icon: typeof Sparkles; className: string }
> = {
  ai: {
    label: "AI Verified",
    description: "Passed automated proctored assessment with AI evaluation.",
    icon: Sparkles,
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  expert: {
    label: "Expert Verified",
    description: "Reviewed and approved by an LUA industry expert.",
    icon: UserCheck,
    className: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  institution: {
    label: "Institution Verified",
    description: "Endorsed by a partner institution or university.",
    icon: Building2,
    className: "bg-violet-50 text-violet-700 ring-violet-200",
  },
  certificate: {
    label: "Certificate Verified",
    description: "Backed by a valid, tamper-proof LUA certificate.",
    icon: Award,
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  diamond: {
    label: "Fully Verified",
    description: "All four verification layers completed. Maximum trust.",
    icon: Gem,
    className: "bg-gradient-brand text-primary-foreground ring-primary/30",
  },
};

export function VerificationBadges({
  types,
  size = "sm",
}: {
  types: VerificationType[];
  size?: "sm" | "md";
}) {
  const fully = types.length >= 4;
  const list = fully ? (["diamond"] as const) : types;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex flex-wrap items-center gap-1.5">
        {list.map((t) => {
          const meta = MAP[t];
          const Icon = meta.icon;
          return (
            <Tooltip key={t}>
              <TooltipTrigger asChild>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset transition-transform hover:scale-105 ${meta.className} ${
                    size === "md" ? "px-2.5 py-1 text-xs" : ""
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {meta.label}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-[220px] text-xs">
                <p className="font-semibold">{meta.label}</p>
                <p className="mt-0.5 text-muted-foreground">{meta.description}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
