import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Bell,
  Mail,
  Save,
  LogOut,
  ClipboardCheck,
  Award,
  ShieldCheck,
  TrendingUp,
  Building2,
  Megaphone,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/lua-logo.png";

export const Route = createFileRoute("/_authenticated/settings/notifications")({
  head: () => ({
    meta: [
      { title: "Notification settings — LUA" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotificationSettingsPage,
});

type Channel = "inApp" | "email";
type PrefKey =
  | "assessmentScheduled"
  | "assessmentReminder"
  | "resultsReady"
  | "certificateIssued"
  | "identityVerification"
  | "employerView"
  | "productUpdates";

type Prefs = Record<PrefKey, Record<Channel, boolean>>;

const CATEGORIES: {
  key: PrefKey;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  recommended?: boolean;
}[] = [
  {
    key: "assessmentScheduled",
    title: "Assessment scheduled",
    desc: "When a new assessment is booked on your calendar.",
    icon: ClipboardCheck,
    recommended: true,
  },
  {
    key: "assessmentReminder",
    title: "Assessment reminders",
    desc: "24-hour and 1-hour reminders before your live assessments.",
    icon: Bell,
    recommended: true,
  },
  {
    key: "resultsReady",
    title: "Results & feedback ready",
    desc: "When AI evaluation and expert review complete.",
    icon: TrendingUp,
    recommended: true,
  },
  {
    key: "certificateIssued",
    title: "Certificate issued",
    desc: "When a new verified credential is available to share.",
    icon: Award,
    recommended: true,
  },
  {
    key: "identityVerification",
    title: "Identity & security",
    desc: "Verification status, login alerts, and account changes.",
    icon: ShieldCheck,
    recommended: true,
  },
  {
    key: "employerView",
    title: "Employer views & requests",
    desc: "When an employer views your profile or requests a credential.",
    icon: Building2,
  },
  {
    key: "productUpdates",
    title: "Product updates",
    desc: "Occasional news about new skills, features, and events.",
    icon: Megaphone,
  },
];

const DEFAULT_PREFS: Prefs = CATEGORIES.reduce((acc, c) => {
  acc[c.key] = {
    inApp: true,
    email: c.recommended ?? false,
  };
  return acc;
}, {} as Prefs);

const STORAGE_KEY = "lua.notification-prefs";

function NotificationSettingsPage() {
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [digest, setDigest] = useState<"instant" | "daily" | "weekly">("instant");
  const [quietHours, setQuietHours] = useState(true);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.prefs) setPrefs({ ...DEFAULT_PREFS, ...parsed.prefs });
        if (parsed.digest) setDigest(parsed.digest);
        if (typeof parsed.quietHours === "boolean") setQuietHours(parsed.quietHours);
      }
    } catch {
      // ignore
    }
  }, []);

  function toggle(key: PrefKey, channel: Channel) {
    setPrefs((p) => ({ ...p, [key]: { ...p[key], [channel]: !p[key][channel] } }));
    setDirty(true);
  }

  function setAll(channel: Channel, value: boolean) {
    setPrefs((p) => {
      const next = { ...p };
      for (const k of Object.keys(next) as PrefKey[]) {
        next[k] = { ...next[k], [channel]: value };
      }
      return next;
    });
    setDirty(true);
  }

  function save() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ prefs, digest, quietHours }),
    );
    setDirty(false);
    toast.success("Notification preferences saved");
  }

  function reset() {
    setPrefs(DEFAULT_PREFS);
    setDigest("instant");
    setQuietHours(true);
    setDirty(true);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="LUA" className="h-9 w-9" />
            <span className="font-display text-lg font-semibold">LUA</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Button variant="ghost" size="sm" asChild className="-ml-3 mb-2">
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4" /> Back to dashboard
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Notification settings</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose which events trigger in-app notifications and email updates.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={reset}>
              Reset defaults
            </Button>
            <Button size="sm" onClick={save} disabled={!dirty}>
              <Save className="h-4 w-4" /> Save changes
            </Button>
          </div>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-soft"
        >
          <div className="flex flex-col gap-3 border-b border-border/60 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">Event notifications</h2>
              <p className="text-xs text-muted-foreground">
                Toggle each channel independently per event type.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                onClick={() => setAll("inApp", true)}
                className="rounded-full border border-border/70 bg-background px-3 py-1 font-medium hover:bg-accent"
              >
                Enable all in-app
              </button>
              <button
                onClick={() => setAll("email", true)}
                className="rounded-full border border-border/70 bg-background px-3 py-1 font-medium hover:bg-accent"
              >
                Enable all email
              </button>
              <button
                onClick={() => {
                  setAll("inApp", false);
                  setAll("email", false);
                }}
                className="rounded-full border border-border/70 bg-background px-3 py-1 font-medium hover:bg-accent"
              >
                Mute all
              </button>
            </div>
          </div>

          <div className="hidden grid-cols-[1fr_120px_120px] gap-4 border-b border-border/60 bg-muted/30 px-5 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:grid">
            <span>Event</span>
            <span className="text-center">
              <Bell className="mx-auto h-3.5 w-3.5" />
              <span className="mt-0.5 block">In-app</span>
            </span>
            <span className="text-center">
              <Mail className="mx-auto h-3.5 w-3.5" />
              <span className="mt-0.5 block">Email</span>
            </span>
          </div>

          <ul className="divide-y divide-border/60">
            {CATEGORIES.map((c) => (
              <li
                key={c.key}
                className="grid gap-4 p-5 sm:grid-cols-[1fr_120px_120px] sm:items-center"
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-brand text-primary-foreground">
                    <c.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{c.title}</p>
                      {c.recommended && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{c.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:justify-center">
                  <span className="text-xs text-muted-foreground sm:hidden">In-app</span>
                  <Toggle
                    checked={prefs[c.key].inApp}
                    onChange={() => toggle(c.key, "inApp")}
                    label={`In-app ${c.title}`}
                  />
                </div>
                <div className="flex items-center gap-2 sm:justify-center">
                  <span className="text-xs text-muted-foreground sm:hidden">Email</span>
                  <Toggle
                    checked={prefs[c.key].email}
                    onChange={() => toggle(c.key, "email")}
                    label={`Email ${c.title}`}
                  />
                </div>
              </li>
            ))}
          </ul>
        </motion.section>

        <section className="grid gap-5 md:grid-cols-2">
          <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand text-primary-foreground">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold">Email digest</h3>
                <p className="text-xs text-muted-foreground">
                  Choose how often to receive non-urgent email updates.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {(
                [
                  { v: "instant", l: "Instant", d: "Send each email as it happens." },
                  { v: "daily", l: "Daily digest", d: "One summary per day at 8:00 AM." },
                  { v: "weekly", l: "Weekly digest", d: "Every Monday morning." },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.v}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                    digest === opt.v
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/70 hover:bg-accent"
                  }`}
                >
                  <input
                    type="radio"
                    name="digest"
                    className="mt-0.5"
                    checked={digest === opt.v}
                    onChange={() => {
                      setDigest(opt.v);
                      setDirty(true);
                    }}
                  />
                  <div>
                    <p className="text-sm font-semibold">{opt.l}</p>
                    <p className="text-xs text-muted-foreground">{opt.d}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand text-primary-foreground">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold">Quiet hours</h3>
                <p className="text-xs text-muted-foreground">
                  Silence non-critical in-app pings between 10 PM and 7 AM.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-border/70 bg-background p-4">
              <div>
                <p className="text-sm font-semibold">Enable quiet hours</p>
                <p className="text-xs text-muted-foreground">
                  Critical security alerts still come through.
                </p>
              </div>
              <Toggle
                checked={quietHours}
                onChange={() => {
                  setQuietHours((q) => !q);
                  setDirty(true);
                }}
                label="Quiet hours"
              />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Preferences are stored on this device for now — we'll sync them across your account
              once verification is fully live.
            </p>
          </div>
        </section>

        <div className="flex justify-end">
          <Button size="lg" onClick={save} disabled={!dirty}>
            <Save className="h-4 w-4" /> Save changes
          </Button>
        </div>
      </main>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-gradient-brand" : "bg-muted"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-background shadow-soft transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
