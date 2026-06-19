import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

serve(async (req) => {
  try {
    const body = await req.json();
    const db = createClient(SUPABASE_URL, SUPABASE_KEY);

    const event   = body?.event || body?.type || "";
    const msgId   = body?.data?.message_id || body?.message_id;
    const status  = body?.data?.status || body?.status || "";
    const to      = body?.data?.to || body?.to || "";

    let statut = "en_attente";
    if (status === "DELIVERED")   statut = "livre";
    if (status === "FAILED" || status === "UNDELIVERABLE") statut = "echec";
    if (status === "SENT")        statut = "envoye";

    if (msgId) {
      await db.from("campaign_messages").update({ statut, delivered_at: statut === "livre" ? new Date().toISOString() : null }).eq("id", msgId);
    }

    if (statut === "echec") {
      await db.from("api_errors").insert({ type: "sent_delivery_failed", message: `SMS non délivré à ${to}`, context: body });
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
});
