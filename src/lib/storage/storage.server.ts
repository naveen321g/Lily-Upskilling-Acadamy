// Local file storage, replacing Supabase Storage. Server-only.
//
// Object metadata lives in storage.objects (so the storage RLS policies from
// the migrations still decide who may upload/read); bytes live on disk under
// LOCAL_STORAGE_DIR (default: ./.local-storage). Downloads go through
// short-lived HMAC-signed URLs served by src/routes/api.storage.$.tsx.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { getPool, withRole, type DbRole } from "@/lib/db/pg.server";

const signingSecret = process.env.STORAGE_SIGNING_SECRET || randomBytes(32).toString("hex");

function storageRoot(): string {
  return resolve(process.env.LOCAL_STORAGE_DIR || join(process.cwd(), ".local-storage"));
}

/** Reject anything that could escape the bucket directory. */
function assertSafePath(bucket: string, path: string): void {
  const ok = /^[A-Za-z0-9_-]+$/.test(bucket) && path.length > 0 && path.length < 1024;
  const segments = path.split("/");
  if (
    !ok ||
    segments.some((s) => !s || s === "." || s === ".." || s.includes("\\") || s.includes("\0"))
  ) {
    throw new StorageError("Invalid object path");
  }
}

function diskPath(bucket: string, path: string): string {
  assertSafePath(bucket, path);
  const root = storageRoot();
  const full = resolve(root, bucket, ...path.split("/"));
  if (!full.startsWith(root + sep)) throw new StorageError("Invalid object path");
  return full;
}

export class StorageError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

type ObjectMetadata = { size: number; mimetype: string };

/** Upload as a signed-in user: RLS on storage.objects decides if it's allowed. */
export async function uploadObject(args: {
  userId: string;
  bucket: string;
  path: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  const { bucket, path, body, contentType } = args;
  const file = diskPath(bucket, path);

  const { rows } = await getPool().query<{
    file_size_limit: number | null;
    allowed_mime_types: string[] | null;
  }>("SELECT file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = $1", [bucket]);
  const config = rows[0];
  if (!config) throw new StorageError("Bucket not found", 404);
  if (config.file_size_limit && body.length > config.file_size_limit) {
    throw new StorageError("The object exceeded the maximum allowed size", 413);
  }
  if (config.allowed_mime_types?.length && !config.allowed_mime_types.includes(contentType)) {
    throw new StorageError(`mime type ${contentType} is not supported`, 415);
  }

  const metadata: ObjectMetadata = { size: body.length, mimetype: contentType };
  try {
    await withRole({ kind: "user", userId: args.userId }, async (client) => {
      await client.query(
        "INSERT INTO storage.objects (bucket_id, name, owner, metadata) VALUES ($1, $2, $3, $4)",
        [bucket, path, args.userId, JSON.stringify(metadata)],
      );
      // Write inside the transaction: if the disk write fails the row rolls back.
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, body);
    });
  } catch (error) {
    const e = error as { code?: string; message?: string };
    if (e.code === "23505") throw new StorageError("The resource already exists", 409);
    if (e.code === "42501")
      throw new StorageError("new row violates row-level security policy", 403);
    throw error;
  }
}

/** Storage API for a given role, shaped like `supabase.storage.from(bucket)` (the subset the app uses). */
export function createStorageClient(role: DbRole) {
  return {
    from(bucket: string) {
      return {
        async list(folder: string, options?: { search?: string }) {
          try {
            const prefix = folder ? `${folder.replace(/\/$/, "")}/` : "";
            const { rows } = await withRole(role, (client) =>
              client.query<{
                name: string;
                metadata: ObjectMetadata;
                created_at: string;
                id: string;
              }>(
                "SELECT id, name, metadata, created_at FROM storage.objects WHERE bucket_id = $1 AND starts_with(name, $2)",
                [bucket, prefix],
              ),
            );
            const data = rows
              .map((r) => ({ ...r, name: r.name.slice(prefix.length) }))
              .filter((r) => !r.name.includes("/"))
              .filter((r) => !options?.search || r.name.includes(options.search));
            return { data, error: null };
          } catch (error) {
            return { data: null, error: { message: (error as Error).message } };
          }
        },

        async remove(paths: string[]) {
          try {
            const { rows } = await withRole(role, (client) =>
              client.query<{ name: string }>(
                "DELETE FROM storage.objects WHERE bucket_id = $1 AND name = ANY($2) RETURNING name",
                [bucket, paths],
              ),
            );
            await Promise.all(rows.map((r) => rm(diskPath(bucket, r.name), { force: true })));
            return { data: rows, error: null };
          } catch (error) {
            return { data: null, error: { message: (error as Error).message } };
          }
        },

        async createSignedUrl(path: string, expiresInSeconds: number) {
          try {
            assertSafePath(bucket, path);
            const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
            const sig = sign(bucket, path, exp);
            const signedUrl = `/api/storage/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}?exp=${exp}&sig=${sig}`;
            return { data: { signedUrl }, error: null };
          } catch (error) {
            return { data: null, error: { message: (error as Error).message } };
          }
        },
      };
    },
  };
}

function sign(bucket: string, path: string, exp: number): string {
  return createHmac("sha256", signingSecret).update(`${bucket}/${path}:${exp}`).digest("base64url");
}

/** Serve a signed download. Returns null if the signature is invalid/expired or the object is gone. */
export async function readSignedObject(
  bucket: string,
  path: string,
  exp: number,
  sig: string,
): Promise<{ body: Buffer; contentType: string } | null> {
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return null;
  const expected = Buffer.from(sign(bucket, path, exp));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  const { rows } = await getPool().query<{ metadata: ObjectMetadata }>(
    "SELECT metadata FROM storage.objects WHERE bucket_id = $1 AND name = $2",
    [bucket, path],
  );
  if (!rows[0]) return null;
  try {
    const body = await readFile(diskPath(bucket, path));
    return { body, contentType: rows[0].metadata?.mimetype || "application/octet-stream" };
  } catch {
    return null;
  }
}
