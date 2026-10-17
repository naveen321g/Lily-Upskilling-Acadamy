// Server-side "service role" client — bypasses RLS (runs as the database
// owner). Backed by local PostgreSQL; keeps the supabaseAdmin export and the
// supabase-js API subset the app uses (.from/.rpc, .auth.admin, .storage).
// For user-authenticated queries (with RLS), use the auth middleware instead.
//
// SECURITY: Only use this for trusted server-side operations, never expose to client code.
// Load inside server handlers: const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
// Top-level import is safe only in other .server.ts files.
import { createServerDbClient } from "@/lib/db/sql.server";
import { createStorageClient } from "@/lib/storage/storage.server";
import { authAdmin } from "@/lib/auth/auth.server";

export const supabaseAdmin = {
  ...createServerDbClient({ kind: "service" }),
  auth: { admin: authAdmin },
  storage: createStorageClient({ kind: "service" }),
};
