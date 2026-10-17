// Create a user account directly in the local database (e.g. the first admin).
//
//   npm run db:create-user -- you@example.com "your-password" --admin --name "Your Name"
//
// --admin also grants the `admin` role. If the email already exists, the
// password is reset and the role is (re)granted instead.
import { randomBytes, scryptSync } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(join(root, ".env"));
} catch {
  // No .env file — rely on the real environment.
}

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const positional = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--name");
const [emailArg, password] = positional;

if (!emailArg || !password) {
  console.error(
    'Usage: npm run db:create-user -- <email> <password> [--admin] [--name "Full Name"]',
  );
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to .env first.");
  process.exit(1);
}

// Must match hashPassword() in src/lib/auth/password.server.ts.
function hashPassword(plain) {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

const email = emailArg.trim().toLowerCase();
const fullName = option("--name") ?? email.split("@")[0];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const existing = await client.query("SELECT id FROM auth.users WHERE email = $1", [email]);
  let userId;
  if (existing.rowCount) {
    userId = existing.rows[0].id;
    await client.query(
      "UPDATE auth.users SET encrypted_password = $2, updated_at = now() WHERE id = $1",
      [userId, hashPassword(password)],
    );
    console.log(`Updated password for existing user ${email}.`);
  } else {
    const { rows } = await client.query(
      `INSERT INTO auth.users (email, encrypted_password, raw_user_meta_data, email_confirmed_at)
       VALUES ($1, $2, $3, now()) RETURNING id`,
      [email, hashPassword(password), JSON.stringify({ full_name: fullName })],
    );
    userId = rows[0].id;
    console.log(`Created user ${email}.`);
  }
  if (flag("--admin")) {
    await client.query(
      "INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'admin') ON CONFLICT DO NOTHING",
      [userId],
    );
    console.log("Granted admin role.");
  }
} finally {
  await client.end();
}
