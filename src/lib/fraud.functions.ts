import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin.server";
import type { FraudSignals } from "./fraud-shared";
import { buildFraudSignals } from "./fraud.server";

export const getFraudSignals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FraudSignals> => {
    await assertAdmin(context.supabase, context.userId);
    return buildFraudSignals(context.supabase);
  });
