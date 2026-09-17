import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth for status language across LUA. Every raw backend
 * status (assessment attempts, skills, certificates, badges, support tickets)
 * maps to one of six conceptual states so the same word always means the same
 * thing, no matter which page you're on.
 */
export type ConceptualState =
  | "not_started"
  | "in_progress"
  | "action_required"
  | "under_review"
  | "completed"
  | "verified"
  | "rejected"
  | "suspended";

export type StatusMeta = {
  state: ConceptualState;
  label: string;
  className: string;
  icon: LucideIcon;
};

const STATE_META: Record<ConceptualState, { label: string; className: string; icon: LucideIcon }> =
  {
    not_started: {
      label: "Not Started",
      className: "bg-slate-100 text-slate-700 ring-slate-200",
      icon: Circle,
    },
    in_progress: {
      label: "In Progress",
      className: "bg-sky-50 text-sky-700 ring-sky-200",
      icon: Clock,
    },
    action_required: {
      label: "Action Required",
      className: "bg-amber-50 text-amber-700 ring-amber-200",
      icon: AlertTriangle,
    },
    under_review: {
      label: "Under Review",
      className: "bg-blue-50 text-blue-700 ring-blue-200",
      icon: Eye,
    },
    completed: {
      label: "Completed",
      className: "bg-violet-50 text-violet-700 ring-violet-200",
      icon: CheckCircle2,
    },
    verified: {
      label: "Verified",
      className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      icon: ShieldCheck,
    },
    rejected: {
      label: "Rejected",
      className: "bg-red-50 text-red-700 ring-red-200",
      icon: XCircle,
    },
    suspended: {
      label: "Suspended",
      className: "bg-rose-50 text-rose-700 ring-rose-200",
      icon: Ban,
    },
  };

export function statusMeta(state: ConceptualState): StatusMeta {
  return { state, ...STATE_META[state] };
}

/**
 * user_skills.status → conceptual state. A skill that's merely been added
 * (status still 'pending', nothing attempted yet) is "Not Started" — only a
 * skill with real progress toward it counts as "In Progress". Without
 * completion/score, every freshly-added skill would misleadingly show
 * "In Progress" next to a "Start Assessment" button.
 */
export function skillState(status: string, completion = 0, score = 0): ConceptualState {
  switch (status) {
    case "verified":
      return "verified";
    case "failed":
    case "expired":
      return "action_required";
    case "pending":
    default:
      return completion > 0 || score > 0 ? "in_progress" : "not_started";
  }
}

/** assessment_attempts.status (+ passed) → conceptual state. */
export function attemptState(status: string, passed?: boolean | null): ConceptualState {
  if (status === "in_progress") return "in_progress";
  if (status === "evaluated") return passed ? "completed" : "action_required";
  return "not_started"; // abandoned
}

/**
 * certificates.status → conceptual state. A pending certificate is waiting
 * on an admin, not on the candidate — that's "Under Review", not
 * "In Progress" (which implies the candidate is the one actively doing
 * something).
 */
export function certificateState(status: string): ConceptualState {
  switch (status) {
    case "approved":
      return "verified";
    case "rejected":
      return "rejected";
    case "pending":
    default:
      return "under_review";
  }
}

/** badges.status → conceptual state. A revoked badge needs the candidate's attention. */
export function badgeState(status: string): ConceptualState {
  return status === "active" ? "verified" : "rejected";
}

/** support_tickets.status → conceptual state. An open ticket is awaiting a response. */
export function ticketState(status: string): ConceptualState {
  switch (status) {
    case "closed":
      return "completed";
    case "in_progress":
      return "in_progress";
    case "escalated":
    case "open":
    default:
      return "action_required";
  }
}

export type SkillCta = { label: string; to: string; params?: Record<string, string> };

/** The single most relevant action for a skill card, given what we actually know about it. */
export function skillCta(skill: {
  status: string;
  completion: number;
  score: number;
  verifications: string[];
  certificateCode: string | null;
}): SkillCta {
  if (skill.status === "failed") return { label: "Review & Retry", to: "/assessments" };
  if (skill.status === "expired") return { label: "Renew", to: "/assessments" };
  if (skill.status === "verified") {
    if (skill.verifications.includes("ai") && !skill.verifications.includes("certificate")) {
      return { label: "Upload Certificate", to: "/certificates" };
    }
    if (skill.certificateCode) {
      return {
        label: "View Certificate",
        to: "/certificates/$id",
        params: { id: skill.certificateCode },
      };
    }
    return { label: "View Badge", to: "/badges" };
  }
  if (skill.completion > 0 || skill.score > 0) {
    return { label: "Continue Assessment", to: "/assessments" };
  }
  return { label: "Start Assessment", to: "/assessments" };
}
