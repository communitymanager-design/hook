import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SENT_API     = "https://api.sent.dm";
const SENT_KEY     = Deno.env.get("SENT_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const h = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*"
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });

  try {
    const { sender_id } = await req.json();
    if (!sender_id) return new Response(JSON.stringify({ error: "sender_id requis" }), { status: 400, headers: h });

    const db = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data: sid } = await db.from("sender_ids").select("*").eq("id", sender_id).single();
    if (!sid) return new Response(JSON.stringify({ error: "Sender ID introuvable" }), { status: 404, headers: h });

    // Create a profile on Sent (= Sender ID)
    const resp = await fetch(`${SENT_API}/v3/profiles`, {
      method: "POST",
      headers: { "x-api-key": SENT_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: sid.name,
        short_name: sid.name.substring(0, 11),
        description: sid.usage_principal || "Envoi SMS marketing Congo",
        billing_model: "organization",
        inherit_contacts: true,
        inherit_templates: true,
        inherit_tcr_brand: true
      })
    });

    const result = await resp.json();

    if (!resp.ok) {
      const msg = result?.error?.message || JSON.stringify(result);
      await db.from("api_errors").insert({ type: "sent_profile_failed", message: msg, context: result });
      return new Response(JSON.stringify({ error: msg }), { status: 502, headers: h });
    }

    const profileId = result?.data?.id;
    await db.from("sender_ids").update({ sent_profile_id: profileId, infobip_ref: profileId }).eq("id", sender_id);
    return new Response(JSON.stringify({ success: true, profile_id: profileId }), { headers: h });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: h });
  }
});
