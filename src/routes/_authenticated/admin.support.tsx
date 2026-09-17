import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getTicketAdmin,
  listTicketsAdmin,
  replyToTicketAdmin,
  updateTicketAdmin,
} from "@/lib/support.functions";
import { formatDate } from "@/lib/format";
import { statusMeta, ticketState } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/admin/support")({
  head: () => ({
    meta: [
      { title: "Support center — LUA admin" },
      { name: "description", content: "Respond to candidate support tickets." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SupportAdminPage,
});

const ALL = "all";

function SupportAdminPage() {
  const fetchTickets = useServerFn(listTicketsAdmin);
  const fetchTicket = useServerFn(getTicketAdmin);
  const reply = useServerFn(replyToTicketAdmin);
  const update = useServerFn(updateTicketAdmin);
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const {
    data: tickets,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["admin-tickets", statusFilter],
    queryFn: () =>
      fetchTickets({ data: { status: statusFilter === ALL ? undefined : statusFilter } }),
  });

  const {
    data: ticket,
    isLoading: ticketLoading,
    isError: ticketError,
    refetch: refetchTicket,
  } = useQuery({
    queryKey: ["admin-ticket", selectedId],
    queryFn: () => fetchTicket({ data: { ticketId: selectedId! } }),
    enabled: Boolean(selectedId),
  });

  const replyMutation = useMutation({
    mutationFn: (m: string) => reply({ data: { ticketId: selectedId!, message: m } }),
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-ticket", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not send reply."),
  });

  const updateMutation = useMutation({
    mutationFn: (patch: {
      status?: "open" | "in_progress" | "escalated" | "closed";
      priority?: "low" | "medium" | "high";
    }) => update({ data: { ticketId: selectedId!, ...patch } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ticket", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not update ticket."),
  });

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <Breadcrumbs items={[{ label: "Admin", to: "/admin" }, { label: "Support" }]} />
        <PageHeader
          eyebrow="Admin"
          title="Support center"
          subtitle="Respond to and manage candidate support tickets."
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]">
          <div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="mb-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <div className="space-y-2">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <LoadingSkeleton key={i} className="h-16" />
                ))
              ) : isError ? (
                <ErrorState
                  title="Couldn't load tickets"
                  description="Please try again."
                  onRetry={() => refetch()}
                />
              ) : tickets?.length ? (
                tickets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selectedId === t.id
                        ? "border-primary/50 bg-primary/5"
                        : "border-border/70 bg-card hover:border-primary/30"
                    }`}
                  >
                    <p className="text-sm font-semibold text-foreground">{t.subject}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.userName} · {statusMeta(ticketState(t.status)).label} · {t.priority}
                    </p>
                  </button>
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
                  No tickets.
                </p>
              )}
            </div>
          </div>

          <div>
            {!selectedId ? (
              <p className="grid h-full min-h-[300px] place-items-center rounded-2xl border border-dashed border-border/70 text-sm text-muted-foreground">
                Select a ticket to view the conversation.
              </p>
            ) : ticketLoading ? (
              <LoadingSkeleton className="h-64" />
            ) : ticketError ? (
              <ErrorState
                title="Couldn't load this ticket"
                description="Please try again."
                onRetry={() => refetchTicket()}
              />
            ) : !ticket ? (
              <p className="text-sm text-muted-foreground">Ticket not found.</p>
            ) : (
              <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
                  <div>
                    <p className="font-semibold text-foreground">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground">{ticket.userName}</p>
                  </div>
                  <div className="flex gap-2">
                    <Select
                      value={ticket.status}
                      onValueChange={(v) =>
                        updateMutation.mutate({
                          status: v as "open" | "in_progress" | "escalated" | "closed",
                        })
                      }
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In progress</SelectItem>
                        <SelectItem value="escalated">Escalated</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={ticket.priority}
                      onValueChange={(v) =>
                        updateMutation.mutate({ priority: v as "low" | "medium" | "high" })
                      }
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-4 max-h-96 space-y-3 overflow-y-auto">
                  {ticket.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[85%] rounded-2xl p-3 text-sm ${
                        m.isAdmin
                          ? "ml-auto bg-gradient-brand text-primary-foreground"
                          : "border border-border/70 bg-background"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.message}</p>
                      <p
                        className={`mt-1 text-[10px] uppercase tracking-wide ${m.isAdmin ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                      >
                        {m.isAdmin ? "You (support)" : ticket.userName} ·{" "}
                        {formatDate(m.createdAt) ?? "—"}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-2 border-t border-border/60 pt-4">
                  <Textarea
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Reply…"
                  />
                  <Button
                    size="sm"
                    onClick={() => message.trim() && replyMutation.mutate(message.trim())}
                    disabled={replyMutation.isPending || !message.trim()}
                    className="gap-1"
                  >
                    <Send className="h-4 w-4" /> Send reply
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </DashboardChrome>
  );
}
