import type { SupportMessage, SupportTicketDetail, SupportTicketSummary } from "./support-shared";
import { notifyAdmins } from "./notifications.server";

// Loosely typed: RLS-scoped Supabase client passed in from a server function's `context.supabase`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

function toMessage(row: {
  id: string;
  author_id: string;
  is_admin: boolean;
  message: string;
  created_at: string;
}): SupportMessage {
  return {
    id: row.id,
    authorId: row.author_id,
    isAdmin: row.is_admin,
    message: row.message,
    createdAt: row.created_at,
  };
}

function toTicketSummary(
  row: {
    id: string;
    subject: string;
    status: string;
    priority: string;
    user_id: string;
    created_at: string;
    updated_at: string;
    support_ticket_messages?: { count: number }[];
  },
  userName: string,
): SupportTicketSummary {
  return {
    id: row.id,
    subject: row.subject,
    status: row.status as SupportTicketSummary["status"],
    priority: row.priority as SupportTicketSummary["priority"],
    userId: row.user_id,
    userName,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messageCount: row.support_ticket_messages?.[0]?.count ?? 0,
  };
}

// No direct FK from support_tickets to profiles (both reference auth.users
// independently), so Postgrest can't embed profiles — fetch and merge separately.
async function namesByUserId(db: Db, userIds: string[]): Promise<Map<string, string>> {
  if (!userIds.length) return new Map();
  const { data } = await db.from("profiles").select("id, full_name").in("id", userIds);
  return new Map(
    ((data ?? []) as { id: string; full_name: string | null }[]).map((p) => [
      p.id,
      p.full_name ?? "Candidate",
    ]),
  );
}

export async function listTicketsFor(db: Db, userId: string): Promise<SupportTicketSummary[]> {
  const { data, error } = await db
    .from("support_tickets")
    .select(
      "id, subject, status, priority, user_id, created_at, updated_at, support_ticket_messages(count)",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  const names = await namesByUserId(db, [userId]);
  return (data ?? []).map((r: Parameters<typeof toTicketSummary>[0]) =>
    toTicketSummary(r, names.get(userId) ?? "Candidate"),
  );
}

export async function listAllTickets(db: Db, status?: string): Promise<SupportTicketSummary[]> {
  let query = db
    .from("support_tickets")
    .select(
      "id, subject, status, priority, user_id, created_at, updated_at, support_ticket_messages(count)",
    )
    .order("updated_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Parameters<typeof toTicketSummary>[0][];
  const names = await namesByUserId(db, Array.from(new Set(rows.map((r) => r.user_id))));
  return rows.map((r) => toTicketSummary(r, names.get(r.user_id) ?? "Candidate"));
}

export async function getTicketWithMessages(
  db: Db,
  ticketId: string,
): Promise<SupportTicketDetail | null> {
  const { data: ticket, error } = await db
    .from("support_tickets")
    .select(
      "id, subject, status, priority, user_id, created_at, updated_at, support_ticket_messages(count)",
    )
    .eq("id", ticketId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!ticket) return null;

  const [{ data: messages, error: msgErr }, names] = await Promise.all([
    db
      .from("support_ticket_messages")
      .select("id, author_id, is_admin, message, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true }),
    namesByUserId(db, [ticket.user_id]),
  ]);
  if (msgErr) throw new Error(msgErr.message);

  return {
    ...toTicketSummary(ticket, names.get(ticket.user_id) ?? "Candidate"),
    messages: (messages ?? []).map((m: Parameters<typeof toMessage>[0]) => toMessage(m)),
  };
}

export async function createTicket(
  db: Db,
  args: { userId: string; subject: string; message: string },
): Promise<{ id: string }> {
  const { data: ticket, error } = await db
    .from("support_tickets")
    .insert({ user_id: args.userId, subject: args.subject })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: msgErr } = await db.from("support_ticket_messages").insert({
    ticket_id: ticket.id,
    author_id: args.userId,
    is_admin: false,
    message: args.message,
  });
  if (msgErr) throw new Error(msgErr.message);

  await notifyAdmins({
    type: "ticket.new",
    title: "New support ticket",
    body: args.subject,
    targetType: "support_ticket",
    targetId: ticket.id,
  });

  return { id: ticket.id };
}

export async function addMessage(
  db: Db,
  args: { ticketId: string; authorId: string; isAdmin: boolean; message: string },
): Promise<void> {
  const { error } = await db.from("support_ticket_messages").insert({
    ticket_id: args.ticketId,
    author_id: args.authorId,
    is_admin: args.isAdmin,
    message: args.message,
  });
  if (error) throw new Error(error.message);
}

export async function updateTicket(
  db: Db,
  ticketId: string,
  patch: { status?: string; priority?: string },
): Promise<void> {
  const { error } = await db.from("support_tickets").update(patch).eq("id", ticketId);
  if (error) throw new Error(error.message);
}
