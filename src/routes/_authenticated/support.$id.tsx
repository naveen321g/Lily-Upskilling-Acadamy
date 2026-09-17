import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { BackLink } from "@/components/shared/BackLink";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getMyTicket, replyToTicket } from "@/lib/support.functions";
import { formatDate } from "@/lib/format";
import { statusMeta, ticketState } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/support/$id")({
  head: () => ({
    meta: [{ title: "Support ticket — LUA" }, { name: "robots", content: "noindex" }],
  }),
  component: TicketThreadPage,
});

function TicketThreadPage() {
  const { id } = Route.useParams();
  const fetchTicket = useServerFn(getMyTicket);
  const reply = useServerFn(replyToTicket);
  const queryClient = useQueryClient();

  const {
    data: ticket,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["my-ticket", id],
    queryFn: () => fetchTicket({ data: { ticketId: id } }),
  });

  const [message, setMessage] = useState("");
  const replyMutation = useMutation({
    mutationFn: (m: string) => reply({ data: { ticketId: id, message: m } }),
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["my-ticket", id] });
      queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not send reply."),
  });

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <Breadcrumbs
          items={[
            { label: "Dashboard", to: "/dashboard" },
            { label: "Support", to: "/support" },
            { label: ticket?.subject ?? "Ticket" },
          ]}
        />
        <BackLink to="/support" label="Back to tickets" />

        {isLoading ? (
          <LoadingSkeleton className="h-64" />
        ) : isError ? (
          <ErrorState
            title="Couldn't load this ticket"
            description="Please try again."
            onRetry={() => refetch()}
          />
        ) : !ticket ? (
          <p className="rounded-2xl border border-dashed border-border/70 bg-card p-10 text-center text-sm text-muted-foreground">
            Ticket not found.
          </p>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{ticket.subject}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Status: {statusMeta(ticketState(ticket.status)).label}
            </p>

            <div className="mt-6 space-y-3">
              {ticket.messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-2xl p-4 text-sm shadow-soft ${
                    m.isAdmin
                      ? "bg-card border border-border/70"
                      : "ml-auto bg-gradient-brand text-primary-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.message}</p>
                  <p
                    className={`mt-2 text-[10px] uppercase tracking-wide ${m.isAdmin ? "text-muted-foreground" : "text-primary-foreground/70"}`}
                  >
                    {m.isAdmin ? "LUA support" : "You"} · {formatDate(m.createdAt) ?? "—"}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
              <Textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write a reply…"
              />
              <Button
                onClick={() => message.trim() && replyMutation.mutate(message.trim())}
                disabled={replyMutation.isPending || !message.trim()}
                className="gap-1"
              >
                <Send className="h-4 w-4" /> Send
              </Button>
            </div>
          </>
        )}
      </main>
    </DashboardChrome>
  );
}
