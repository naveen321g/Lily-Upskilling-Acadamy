import { createFileRoute } from "@tanstack/react-router";

// Local file storage endpoints (replacing Supabase Storage):
//   POST /api/storage/upload/<bucket>/<path>   — raw file body, session cookie required
//   GET  /api/storage/object/<bucket>/<path>?exp=&sig=  — signed download URL
// See src/lib/storage/storage.server.ts.

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function parse(splat: string | undefined) {
  const [kind, bucket, ...rest] = (splat ?? "").split("/");
  return { kind, bucket, path: rest.map(decodeURIComponent).join("/") };
}

export const Route = createFileRoute("/api/storage/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { kind, bucket, path } = parse(params._splat);
        if (kind !== "object" || !bucket || !path)
          return new Response("Not found", { status: 404 });
        const url = new URL(request.url);
        const { readSignedObject } = await import("@/lib/storage/storage.server");
        const object = await readSignedObject(
          bucket,
          path,
          Number(url.searchParams.get("exp")),
          url.searchParams.get("sig") ?? "",
        ).catch(() => null);
        if (!object) return new Response("Not found or link expired", { status: 404 });
        return new Response(new Uint8Array(object.body), {
          headers: {
            "content-type": object.contentType,
            "cache-control": "private, no-store",
            "x-content-type-options": "nosniff",
          },
        });
      },

      POST: async ({ request, params }) => {
        const { kind, bucket, path } = parse(params._splat);
        if (kind !== "upload" || !bucket || !path) return json({ message: "Not found" }, 404);

        const { getUserForToken } = await import("@/lib/auth/auth.server");
        const { SESSION_COOKIE } = await import("@/lib/auth/auth-shared");
        const cookie = (request.headers.get("cookie") ?? "")
          .split(/;\s*/)
          .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
        const token = cookie
          ? decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1))
          : undefined;
        const user = await getUserForToken(token);
        if (!user) return json({ message: "Unauthorized" }, 401);

        const { uploadObject, StorageError } = await import("@/lib/storage/storage.server");
        try {
          await uploadObject({
            userId: user.id,
            bucket,
            path,
            body: Buffer.from(await request.arrayBuffer()),
            contentType: request.headers.get("content-type") ?? "application/octet-stream",
          });
          return json({ path });
        } catch (error) {
          if (error instanceof StorageError) return json({ message: error.message }, error.status);
          console.error(error);
          return json({ message: "Upload failed" }, 500);
        }
      },
    },
  },
});
