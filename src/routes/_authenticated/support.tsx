import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/skills/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createSupportTicket, listMyTickets } from "@/lib/support.functions";
import { formatDate } from "@/lib/format";
import { statusMeta, ticketState } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({
    meta: [
      { title: "Support — LUA" },
      {
        name: "description",
        content: "Get help with your LUA account, assessments and certificates.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  const fetchTickets = useServerFn(listMyTickets);
  const create = useServerFn(createSupportTicket);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-tickets"],
    queryFn: () => fetchTickets(),
  });

  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (subject.trim().length < 3) return toast.error("Give your issue a short subject.");
    if (message.trim().length < 5) return toast.error("Describe the issue in a bit more detail.");
    setSubmitting(true);
    try {
      await create({ data: { subject: subject.trim(), message: message.trim() } });
      toast.success("Ticket submitted.");
      setOpen(false);
      setSubject("");
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <Breadcrumbs items={[{ label: "Dashboard", to: "/dashboard" }, { label: "Support" }]} />
        <PageHeader
          eyebrow="Help"
          title="Support"
          subtitle="Have an issue with your account, an assessment or a certificate? File a ticket and we'll get back to you."
          actions={
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="gap-1 bg-gradient-brand text-primary-foreground hover:opacity-95">
                  <MessageSquarePlus className="h-4 w-4" /> New ticket
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New support ticket</DialogTitle>
                  <DialogDescription>
                    Tell us what's going on — an LUA team member will reply here.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="ticket-subject">Subject</Label>
                    <Input
                      id="ticket-subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Certificate not showing up"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ticket-message">Details</Label>
                    <Textarea
                      id="ticket-message"
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Describe what happened…"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={submit} disabled={submitting} className="w-full">
                    {submitting ? "Submitting…" : "Submit ticket"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          }
        />

        <div className="mt-8 space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <LoadingSkeleton key={i} className="h-20" />)
          ) : isError ? (
            <ErrorState
              title="Couldn't load your tickets"
              description="Please try again."
              onRetry={() => refetch()}
            />
          ) : data?.length ? (
            data.map((t) => {
              const meta = statusMeta(ticketState(t.status));
              const Icon = meta.icon;
              return (
                <Link
                  key={t.id}
                  to="/support/$id"
                  params={{ id: t.id }}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-soft transition hover:border-primary/40 hover:shadow-elevated"
                >
                  <div>
                    <p className="font-semibold text-foreground">{t.subject}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Updated {formatDate(t.updatedAt) ?? "—"} · {t.messageCount} message
                      {t.messageCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${meta.className}`}
                  >
                    <Icon className="h-3 w-3" /> {meta.label}
                  </span>
                </Link>
              );
            })
          ) : (
            <EmptyState
              title="No support tickets yet"
              description="If something's not working right, file a ticket and we'll help you out."
              actionLabel="New ticket"
              onAction={() => setOpen(true)}
            />
          )}
        </div>
      </main>
    </DashboardChrome>
  );
}
