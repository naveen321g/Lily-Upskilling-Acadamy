import { createMiddleware } from "@tanstack/react-start";

// Server function middleware: requires a signed-in user (session cookie) and
// injects `context.{ supabase, userId, claims }`, where `context.supabase` is a
// database client that runs as `authenticated` with auth.uid() = userId, so
// RLS policies apply exactly as they did on Supabase.
export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const { getCurrentUser } = await import("@/lib/auth/auth.server");
    const user = await getCurrentUser();
    if (!user) {
      throw new Error("Unauthorized: not signed in");
    }

    const { createServerDbClient } = await import("@/lib/db/sql.server");
    const { createStorageClient } = await import("@/lib/storage/storage.server");
    const role = { kind: "user", userId: user.id } as const;
    const supabase = { ...createServerDbClient(role), storage: createStorageClient(role) };

    return next({
      context: {
        supabase,
        userId: user.id,
        claims: { sub: user.id, email: user.email, role: "authenticated" },
      },
    });
  },
);
