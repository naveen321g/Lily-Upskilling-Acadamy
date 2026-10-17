import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { AuthSession } from "./auth-shared";

// Auth RPCs used by the browser client in src/integrations/supabase/client.ts.
// Errors are returned (not thrown) so the client can mirror supabase-js's
// `{ data, error }` shape.

type AuthResult = { session: AuthSession | null; error: string | null };

async function authResult(fn: () => Promise<AuthSession | null>): Promise<AuthResult> {
  const { AuthError } = await import("./auth.server");
  try {
    return { session: await fn(), error: null };
  } catch (error) {
    if (error instanceof AuthError) return { session: null, error: error.message };
    console.error("[auth]", error);
    return { session: null, error: "Something went wrong. Please try again." };
  }
}

const email = z.string().trim().email().max(255);
const password = z.string().min(8, "Password must be at least 8 characters").max(72);

export const getAuthSession = createServerFn({ method: "GET" }).handler(async () => {
  const { getCurrentSession } = await import("./auth.server");
  return getCurrentSession();
});

export const signUpWithPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ email, password, fullName: z.string().trim().max(100).optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { signUp } = await import("./auth.server");
    return authResult(() => signUp(data));
  });

export const signInWithPasswordFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ email, password: z.string().min(1).max(72) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { signInWithPassword } = await import("./auth.server");
    return authResult(() => signInWithPassword(data));
  });

export const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
  const { signOut } = await import("./auth.server");
  await signOut();
  return { ok: true };
});

export const requestPasswordResetFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ email }).parse(input))
  .handler(async ({ data }) => {
    const { requestPasswordReset } = await import("./auth.server");
    return authResult(async () => {
      await requestPasswordReset(data.email);
      return null;
    });
  });

/** With `token` (from the reset link): reset via token. Without: change the signed-in user's password. */
export const updatePasswordFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ password, token: z.string().min(1).max(200).optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { AuthError, getCurrentSession, resetPasswordWithToken, updatePassword } =
      await import("./auth.server");
    return authResult(async () => {
      if (data.token) return resetPasswordWithToken(data.token, data.password);
      const session = await getCurrentSession();
      if (!session) {
        throw new AuthError("Your reset link is missing or has expired. Request a new one.");
      }
      await updatePassword(session.user.id, data.password);
      return session;
    });
  });
