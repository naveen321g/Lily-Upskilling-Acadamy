import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, logAudit } from "./admin.server";
import type { SupportTicketDetail, SupportTicketSummary } from "./support-shared";
import {
  addMessage,
  createTicket,
  getTicketWithMessages,
  listAllTickets,
  listTicketsFor,
  updateTicket,
} from "./support.server";

export const listMyTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SupportTicketSummary[]> => {
    return listTicketsFor(context.supabase, context.userId);
  });

export const createSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        subject: z.string().trim().min(3).max(150),
        message: z.string().trim().min(5).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    return createTicket(context.supabase, {
      userId: context.userId,
      subject: data.subject,
      message: data.message,
    });
  });

export const getMyTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ ticketId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<SupportTicketDetail | null> => {
    return getTicketWithMessages(context.supabase, data.ticketId);
  });

export const replyToTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ ticketId: z.string().uuid(), message: z.string().trim().min(1).max(4000) })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await addMessage(context.supabase, {
      ticketId: data.ticketId,
      authorId: context.userId,
      isAdmin: false,
      message: data.message,
    });
    // Reopen a closed ticket when the candidate follows up.
    await updateTicket(context.supabase, data.ticketId, { status: "open" });
    return { ok: true };
  });

export const listTicketsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ status: z.string().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<SupportTicketSummary[]> => {
    await assertAdmin(context.supabase, context.userId);
    return listAllTickets(context.supabase, data.status);
  });

export const getTicketAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ ticketId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<SupportTicketDetail | null> => {
    await assertAdmin(context.supabase, context.userId);
    return getTicketWithMessages(context.supabase, data.ticketId);
  });

export const replyToTicketAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ ticketId: z.string().uuid(), message: z.string().trim().min(1).max(4000) })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    await addMessage(context.supabase, {
      ticketId: data.ticketId,
      authorId: context.userId,
      isAdmin: true,
      message: data.message,
    });
    return { ok: true };
  });

export const updateTicketAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        status: z.enum(["open", "in_progress", "escalated", "closed"]).optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const patch: { status?: string; priority?: string } = {};
    if (data.status) patch.status = data.status;
    if (data.priority) patch.priority = data.priority;
    await updateTicket(context.supabase, data.ticketId, patch);
    await logAudit(
      context.supabase,
      context.userId,
      "ticket.update",
      "support_ticket",
      data.ticketId,
      patch,
    );
    return { ok: true };
  });
