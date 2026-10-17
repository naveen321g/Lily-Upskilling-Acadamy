// Email + password auth backed by the local auth.users / auth.sessions tables. Server-only.
import { createHash, randomBytes } from "node:crypto";
import { deleteCookie, getCookie, getRequestUrl, setCookie } from "@tanstack/react-start/server";
import { getPool } from "@/lib/db/pg.server";
import { hashPassword, verifyPassword } from "./password.server";
import {
  PASSWORD_RESET_TTL_MINUTES,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  type AuthSession,
  type AuthUser,
} from "./auth-shared";

type UserRow = {
  id: string;
  email: string;
  encrypted_password: string;
  raw_user_meta_data: Record<string, unknown>;
  raw_app_meta_data: Record<string, unknown>;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
};

export class AuthError extends Error {}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");
const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    user_metadata: pickMetadata(row.raw_user_meta_data),
    aud: "authenticated",
    created_at: row.created_at,
    last_sign_in_at: row.last_sign_in_at,
  };
}

function pickMetadata(meta: Record<string, unknown> | null): AuthUser["user_metadata"] {
  const out: AuthUser["user_metadata"] = {};
  if (typeof meta?.full_name === "string") out.full_name = meta.full_name;
  if (typeof meta?.avatar_url === "string") out.avatar_url = meta.avatar_url;
  return out;
}

function isBanned(row: Pick<UserRow, "banned_until">): boolean {
  return !!row.banned_until && new Date(row.banned_until).getTime() > Date.now();
}

function toSession(user: AuthUser): AuthSession {
  return { access_token: "cookie", token_type: "cookie", user };
}

// ============ SESSIONS ============

async function startSession(userId: string): Promise<void> {
  const token = newToken();
  await getPool().query(
    `INSERT INTO auth.sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + make_interval(secs => $3))`,
    [userId, sha256(token), SESSION_MAX_AGE_SECONDS],
  );
  await getPool().query("UPDATE auth.users SET last_sign_in_at = now() WHERE id = $1", [userId]);
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: getRequestUrl().protocol === "https:",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Resolve the signed-in user from a raw session token (cookie value). */
export async function getUserForToken(token: string | undefined): Promise<AuthUser | null> {
  if (!token) return null;
  const { rows } = await getPool().query<UserRow>(
    `SELECT u.* FROM auth.sessions s JOIN auth.users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha256(token)],
  );
  const row = rows[0];
  if (!row || isBanned(row)) return null;
  return toAuthUser(row);
}

/** The signed-in user for the current request (from the session cookie), or null. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  return getUserForToken(getCookie(SESSION_COOKIE));
}

export async function getCurrentSession(): Promise<AuthSession | null> {
  const user = await getCurrentUser();
  return user ? toSession(user) : null;
}

// ============ SIGN UP / IN / OUT ============

export async function signUp(args: {
  email: string;
  password: string;
  fullName?: string;
}): Promise<AuthSession> {
  const email = normalizeEmail(args.email);
  const existing = await getPool().query("SELECT 1 FROM auth.users WHERE email = $1", [email]);
  if (existing.rowCount) throw new AuthError("User already registered");

  const meta = args.fullName ? { full_name: args.fullName.trim() } : {};
  // Inserting into auth.users fires handle_new_user(), which creates the profile row.
  const { rows } = await getPool().query<UserRow>(
    `INSERT INTO auth.users (email, encrypted_password, raw_user_meta_data, email_confirmed_at)
     VALUES ($1, $2, $3, now()) RETURNING *`,
    [email, await hashPassword(args.password), JSON.stringify(meta)],
  );
  await startSession(rows[0].id);
  return toSession(toAuthUser(rows[0]));
}

export async function signInWithPassword(args: {
  email: string;
  password: string;
}): Promise<AuthSession> {
  const { rows } = await getPool().query<UserRow>("SELECT * FROM auth.users WHERE email = $1", [
    normalizeEmail(args.email),
  ]);
  const row = rows[0];
  if (!row || !(await verifyPassword(args.password, row.encrypted_password))) {
    throw new AuthError("Invalid login credentials");
  }
  if (isBanned(row)) throw new AuthError("User is banned");
  await startSession(row.id);
  return toSession(toAuthUser(row));
}

export async function signOut(): Promise<void> {
  const token = getCookie(SESSION_COOKIE);
  if (token)
    await getPool().query("DELETE FROM auth.sessions WHERE token_hash = $1", [sha256(token)]);
  deleteCookie(SESSION_COOKIE, { path: "/" });
}

// ============ PASSWORDS ============

/**
 * Create a reset token and email the link. If SMTP isn't configured, the
 * link is printed to the server console instead (handy for local use).
 * Always succeeds, so the response never reveals whether an email exists.
 */
export async function requestPasswordReset(emailInput: string): Promise<void> {
  const email = normalizeEmail(emailInput);
  const { rows } = await getPool().query<{ id: string }>(
    "SELECT id FROM auth.users WHERE email = $1",
    [email],
  );
  if (!rows[0]) return;

  const token = newToken();
  await getPool().query(
    `INSERT INTO auth.password_reset_tokens (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(mins => $3))`,
    [sha256(token), rows[0].id, PASSWORD_RESET_TTL_MINUTES],
  );

  const origin = process.env.APP_URL?.replace(/\/$/, "") || getRequestUrl().origin;
  const link = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
  const { sendMail } = await import("./mail.server");
  await sendMail({
    to: email,
    subject: "Reset your LUA password",
    text: `Someone requested a password reset for your Lily Upskilling Academy account.\n\nSet a new password: ${link}\n\nThis link expires in ${PASSWORD_RESET_TTL_MINUTES} minutes. If you didn't ask for this, ignore this email.`,
  });
}

/** Set a new password using a reset-link token, sign the user in, and end their other sessions. */
export async function resetPasswordWithToken(
  token: string,
  password: string,
): Promise<AuthSession> {
  const { rows } = await getPool().query<{ user_id: string }>(
    `UPDATE auth.password_reset_tokens SET used_at = now()
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
     RETURNING user_id`,
    [sha256(token)],
  );
  const userId = rows[0]?.user_id;
  if (!userId)
    throw new AuthError("This password reset link is invalid or has expired. Request a new one.");

  await getPool().query(
    "UPDATE auth.users SET encrypted_password = $2, updated_at = now() WHERE id = $1",
    [userId, await hashPassword(password)],
  );
  await getPool().query("DELETE FROM auth.sessions WHERE user_id = $1", [userId]);
  await startSession(userId);
  const user = await getCurrentUserById(userId);
  if (!user) throw new AuthError("User not found");
  return toSession(user);
}

/** Change the signed-in user's password. */
export async function updatePassword(userId: string, password: string): Promise<void> {
  await getPool().query(
    "UPDATE auth.users SET encrypted_password = $2, updated_at = now() WHERE id = $1",
    [userId, await hashPassword(password)],
  );
}

async function getCurrentUserById(userId: string): Promise<AuthUser | null> {
  const { rows } = await getPool().query<UserRow>("SELECT * FROM auth.users WHERE id = $1", [
    userId,
  ]);
  return rows[0] ? toAuthUser(rows[0]) : null;
}

// ============ ADMIN (replaces supabase.auth.admin) ============

export type AdminAuthUser = AuthUser & { banned_until: string | null };

const toAdminUser = (row: UserRow): AdminAuthUser => ({
  ...toAuthUser(row),
  banned_until: row.banned_until,
});

export const authAdmin = {
  async listUsers(opts: { page?: number; perPage?: number } = {}) {
    const perPage = opts.perPage ?? 50;
    const offset = ((opts.page ?? 1) - 1) * perPage;
    const { rows } = await getPool().query<UserRow>(
      "SELECT * FROM auth.users ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [perPage, offset],
    );
    return { data: { users: rows.map(toAdminUser) }, error: null };
  },

  async getUserById(userId: string) {
    const { rows } = await getPool().query<UserRow>("SELECT * FROM auth.users WHERE id = $1", [
      userId,
    ]);
    if (!rows[0]) return { data: { user: null }, error: { message: "User not found" } };
    return { data: { user: toAdminUser(rows[0]) }, error: null };
  },

  /** Supports the `ban_duration` attribute the app uses ("876000h" to ban, "none" to unban). */
  async updateUserById(userId: string, attrs: { ban_duration?: string }) {
    if (attrs.ban_duration !== undefined) {
      const hours = /^(\d+)h$/.exec(attrs.ban_duration)?.[1];
      await getPool().query(
        "UPDATE auth.users SET banned_until = $2, updated_at = now() WHERE id = $1",
        [
          userId,
          attrs.ban_duration === "none" || !hours
            ? null
            : new Date(Date.now() + Number(hours) * 3_600_000),
        ],
      );
      // A ban ends the user's sessions immediately.
      if (hours) await getPool().query("DELETE FROM auth.sessions WHERE user_id = $1", [userId]);
    }
    return { data: null, error: null };
  },
};
