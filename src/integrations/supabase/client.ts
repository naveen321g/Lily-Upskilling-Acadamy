// Browser/SSR data + auth client, backed by the app's own server (local
// PostgreSQL) instead of Supabase. It keeps the `supabase` export and the
// subset of the supabase-js API the app uses, so callers didn't change:
//   - supabase.from(...) / .rpc(...)  -> runClientQuery / runClientRpc server
//     functions, executed under the caller's RLS role (like PostgREST).
//   - supabase.auth.*                 -> auth server functions; the session is
//     an httpOnly cookie, so no token is stored in localStorage.
//   - supabase.storage.from(b).upload -> POST /api/storage/upload/...
//
// Import it like this:
// import { supabase } from "@/integrations/supabase/client";
import { createDbClient, type DbResult } from "@/lib/db/query-builder";
import { runClientQuery, runClientRpc } from "@/lib/db/client-query.functions";
import {
  getAuthSession,
  requestPasswordResetFn,
  signInWithPasswordFn,
  signOutFn,
  signUpWithPassword,
  updatePasswordFn,
} from "@/lib/auth/auth.functions";
import type { AuthChangeEvent, AuthSession, AuthUser } from "@/lib/auth/auth-shared";

type AuthListener = (event: AuthChangeEvent, session: AuthSession | null) => void;
type AuthErrorResult = { message: string; name: "AuthError" } | null;

const listeners = new Set<AuthListener>();
let sessionPromise: Promise<AuthSession | null> | undefined;

function fetchSession(): Promise<AuthSession | null> {
  if (typeof window === "undefined") return getAuthSession(); // never cache across SSR requests
  sessionPromise ??= getAuthSession().catch((error) => {
    sessionPromise = undefined;
    throw error;
  });
  return sessionPromise;
}

function setSession(event: AuthChangeEvent, session: AuthSession | null) {
  sessionPromise = Promise.resolve(session);
  for (const listener of listeners) listener(event, session);
}

const toError = (message: string | null): AuthErrorResult =>
  message ? { message, name: "AuthError" } : null;

const db = createDbClient(
  (spec) => runClientQuery({ data: spec }) as Promise<DbResult>,
  (fn, args) => runClientRpc({ data: { fn, args } }) as Promise<DbResult>,
);

const auth = {
  async getSession(): Promise<{ data: { session: AuthSession | null }; error: null }> {
    return { data: { session: await fetchSession() }, error: null };
  },

  /** Always asks the server (like supabase-js's getUser), so it reflects bans/expiry. */
  async getUser(): Promise<{ data: { user: AuthUser | null }; error: AuthErrorResult }> {
    const session = await getAuthSession();
    sessionPromise = Promise.resolve(session);
    return {
      data: { user: session?.user ?? null },
      error: session ? null : toError("Auth session missing!"),
    };
  },

  onAuthStateChange(callback: AuthListener) {
    listeners.add(callback);
    fetchSession()
      .then((session) => listeners.has(callback) && callback("INITIAL_SESSION", session))
      .catch(() => {});
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            listeners.delete(callback);
          },
        },
      },
    };
  },

  async signInWithPassword(credentials: { email: string; password: string }) {
    const { session, error } = await signInWithPasswordFn({ data: credentials });
    if (session) setSession("SIGNED_IN", session);
    return { data: { session, user: session?.user ?? null }, error: toError(error) };
  },

  async signUp(args: {
    email: string;
    password: string;
    options?: { data?: { full_name?: string } };
  }) {
    const { session, error } = await signUpWithPassword({
      data: { email: args.email, password: args.password, fullName: args.options?.data?.full_name },
    });
    if (session) setSession("SIGNED_IN", session);
    return { data: { session, user: session?.user ?? null }, error: toError(error) };
  },

  async signOut() {
    await signOutFn();
    setSession("SIGNED_OUT", null);
    return { error: null };
  },

  async resetPasswordForEmail(email: string, _options?: { redirectTo?: string }) {
    const { error } = await requestPasswordResetFn({ data: { email } });
    return { data: {}, error: toError(error) };
  },

  /** Only password changes are supported. Pass `token` from a reset link to reset a forgotten password. */
  async updateUser(attrs: { password: string; token?: string }) {
    const { session, error } = await updatePasswordFn({
      data: { password: attrs.password, token: attrs.token },
    });
    if (session) setSession("USER_UPDATED", session);
    return { data: { user: session?.user ?? null }, error: toError(error) };
  },
};

const storage = {
  from(bucket: string) {
    return {
      async upload(path: string, file: Blob, options?: { contentType?: string }) {
        const encoded = path.split("/").map(encodeURIComponent).join("/");
        const res = await fetch(`/api/storage/upload/${encodeURIComponent(bucket)}/${encoded}`, {
          method: "POST",
          headers: {
            "content-type": options?.contentType || file.type || "application/octet-stream",
          },
          body: file,
          credentials: "same-origin",
        });
        const body = (await res.json().catch(() => ({}))) as { path?: string; message?: string };
        if (!res.ok) {
          return {
            data: null,
            error: {
              message: body.message ?? `Upload failed (${res.status})`,
              name: "StorageError",
            },
          };
        }
        return { data: { path: body.path ?? path }, error: null };
      },
    };
  },
};

export const supabase = { ...db, auth, storage };
