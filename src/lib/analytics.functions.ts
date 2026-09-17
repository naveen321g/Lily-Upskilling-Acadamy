import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin.server";
import type { AnalyticsSummary } from "./analytics-shared";
import { buildAnalyticsSummary } from "./analytics.server";

export const getAnalyticsSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AnalyticsSummary> => {
    await assertAdmin(context.supabase, context.userId);
    return buildAnalyticsSummary(context.supabase);
  });
