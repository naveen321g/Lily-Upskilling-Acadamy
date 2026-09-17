import type { AdminNotification } from "./notifications-shared";

// Loosely typed: admin_notifications was added by a hand-written migration and
// isn't in the generated Database type yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Create a system notification for admins. Best-effort — never blocks the caller. */
export async function notifyAdmins(args: {
  type: string;
  title: string;
  body?: string;
  targetType?: string;
  targetId?: string;
}): Promise<void> {
  try {
    const db: Db = await admin();
    const { error } = await db.from("admin_notifications").insert({
      type: args.type,
      title: args.title,
      body: args.body ?? null,
      target_type: args.targetType ?? null,
      target_id: args.targetId ?? null,
    });
    if (error) console.error("[notifications] failed to record entry", error);
  } catch (error) {
    console.error("[notifications] failed to record entry", error);
  }
}

function toNotification(row: {
  id: string;
  type: string;
  title: string;
  body: string | null;
  target_type: string | null;
  target_id: string | null;
  is_read: boolean;
  created_at: string;
}): AdminNotification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    targetType: row.target_type,
    targetId: row.target_id,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

export async function listNotifications(db: Db): Promise<AdminNotification[]> {
  const { data, error } = await db
    .from("admin_notifications")
    .select("id, type, title, body, target_type, target_id, is_read, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Parameters<typeof toNotification>[0]) => toNotification(r));
}

export async function markNotificationRead(db: Db, id: string): Promise<void> {
  const { error } = await db.from("admin_notifications").update({ is_read: true }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(db: Db): Promise<void> {
  const { error } = await db
    .from("admin_notifications")
    .update({ is_read: true })
    .eq("is_read", false);
  if (error) throw new Error(error.message);
}

// DELETE was never granted to `authenticated` on this table (only SELECT/UPDATE —
// see the migration), so these must go through the service-role client rather
// than the caller's RLS-scoped one, same as every other admin-only mutation.
export async function deleteNotification(id: string): Promise<void> {
  const db: Db = await admin();
  const { error } = await db.from("admin_notifications").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
