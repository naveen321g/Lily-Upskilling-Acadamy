// Auth types shared by client and server. Shaped like the subset of
// supabase-js's User/Session the app reads, so callers didn't need to change.

export type AuthUser = {
  id: string;
  email: string;
  user_metadata: { full_name?: string; avatar_url?: string };
  aud: "authenticated";
  created_at: string;
  last_sign_in_at: string | null;
};

export type AuthSession = {
  /** The real session token lives in an httpOnly cookie; this is a placeholder for code that checks truthiness. */
  access_token: string;
  token_type: "cookie";
  user: AuthUser;
};

export type AuthChangeEvent =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "USER_UPDATED"
  | "PASSWORD_RECOVERY";

export const SESSION_COOKIE = "lua_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const PASSWORD_RESET_TTL_MINUTES = 60;
