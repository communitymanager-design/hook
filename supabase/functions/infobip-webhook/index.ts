import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const db = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  try {
    const body = await req.json();
    const results = body?.results || [];

    for (const r of results) {
      const msgId = r.messageId;
      const status = r.status?.groupName;

      let statut = null;
      if (status === "DELIVERED") statut = "delivered";
      else if (status === "UNDELIVERABLE" || status === "REJECTED" || status === "EXPIRED") statut = "failed";
      else if (status === "PENDING" || status === "SENT") statut = "sent";

      if (msgId && statut) {
        const updatePayload: Record<string, unknown> = { statut };
        if (statut === "delivered") updatePayload.delivered_at = new Date().toISOString();

        const { error } = await db
          .from("campaign_messages")
          .update(updatePayload)
          .eq("operator_message_id", msgId);

        if (error) {
          await db.from("api_errors").insert({
            type: "infobip_webhook_update_failed",
            message: error.message,
            context: { msgId, status, error }
          });
        }
      }
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
});
