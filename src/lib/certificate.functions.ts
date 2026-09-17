import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, logAudit } from "./admin.server";
import type { CertificateSummary, PendingCertificateReview } from "./certificate-shared";
import {
  insertCertificateUpload,
  listAllCertificatesRows,
  listMyCertificateRows,
  listPendingUploadReviews,
  setCertificateReview,
  validateUploadedFile,
} from "./certificate.server";

export const listMyCertificates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CertificateSummary[]> => {
    return listMyCertificateRows(context.supabase, context.userId);
  });

export const submitCertificateUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        skillId: z.string().uuid(),
        title: z.string().trim().min(3).max(150),
        filePath: z.string().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string; code: string }> => {
    // The file path must live under the caller's own folder — matches the
    // storage RLS policy and stops a forged path from referencing someone else's upload.
    if (!data.filePath.startsWith(`${context.userId}/`)) {
      throw new Error("Invalid file path.");
    }
    await validateUploadedFile(context.supabase, data.filePath);
    return insertCertificateUpload(context.supabase, {
      userId: context.userId,
      skillId: data.skillId,
      title: data.title,
      filePath: data.filePath,
    });
  });

export const listAllCertificatesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CertificateSummary[]> => {
    await assertAdmin(context.supabase, context.userId);
    return listAllCertificatesRows(context.supabase);
  });

export const listPendingCertificateReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PendingCertificateReview[]> => {
    await assertAdmin(context.supabase, context.userId);
    return listPendingUploadReviews();
  });

export const reviewCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        certificateId: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        notes: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    await setCertificateReview({
      certificateId: data.certificateId,
      decision: data.decision,
      notes: data.notes?.trim() || null,
      reviewerId: context.userId,
    });
    await logAudit(
      context.supabase,
      context.userId,
      `certificate.${data.decision}`,
      "certificate",
      data.certificateId,
      { notes: data.notes ?? null },
    );
    return { ok: true };
  });
