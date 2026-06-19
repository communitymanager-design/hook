import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const INFOBIP_KEY     = Deno.env.get("INFOBIP_API_KEY") ?? "";
const INFOBIP_BASEURL = Deno.env.get("INFOBIP_BASE_URL") ?? "api.infobip.com";
const SUPABASE_URL    = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*"
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  try {
    const { campaign_id } = await req.json();
    if (!campaign_id) return new Response(JSON.stringify({ error: "campaign_id requis" }), { status: 400, headers });

    const db = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Load campaign
    const { data: camp, error: campErr } = await db
      .from("campaigns")
      .select("*, sender_ids(name)")
      .eq("id", campaign_id)
      .single();

    if (campErr || !camp) return new Response(JSON.stringify({ error: "Campagne introuvable" }), { status: 404, headers });

    // Load contacts selon le ciblage reel de la campagne (segment choisi, contacts libres, ou tous)
    let contactsQuery = db
      .from("contacts")
      .select("id,telephone")
      .eq("organization_id", camp.organization_id)
      .eq("statut", "actif")
      .not("telephone", "is", null);

    if (camp.target_filter === "free") {
      contactsQuery = contactsQuery.is("segment_id", null);
    } else if (camp.target_filter !== "all" && camp.segment_id) {
      contactsQuery = contactsQuery.eq("segment_id", camp.segment_id);
    }

    const { data: contacts } = await contactsQuery;

    if (!contacts?.length) return new Response(JSON.stringify({ error: "Aucun contact actif dans la cible selectionnee" }), { status: 400, headers });

    const sender  = camp.sender_ids?.name || "InfoSMS";
    const message = camp.message || camp.message_final || "";

    // Send in batches of 100
    const BATCH = 100;
    let sent = 0, errors = 0;

    for (let i = 0; i < contacts.length; i += BATCH) {
      const batch = contacts.slice(i, i + BATCH);

      const payload = {
        messages: [{
          sender,
          destinations: batch.map((c: any) => ({ to: c.telephone })),
          content: { text: message },
          notifyUrl: `${SUPABASE_URL}/functions/v1/infobip-webhook`,
          notifyContentType: "application/json"
        }]
      };

      const res = await fetch(`https://${INFOBIP_BASEURL}/sms/3/messages`, {
        method: "POST",
        headers: {
          "Authorization": `App ${INFOBIP_KEY}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        errors++;
        const errMsg = data?.requestError?.serviceException?.text || JSON.stringify(data);
        await db.from("api_errors").insert({
          type: "infobip_send_failed",
          message: errMsg,
          context: data,
          organization_id: camp.organization_id
        });
        continue;
      }

      // Map phone -> contact_id pour rattacher chaque message Infobip au bon contact
      const phoneToContact = new Map(batch.map((c: any) => [c.telephone, c.id]));

      const msgs = data?.messages || [];
      if (msgs.length) {
        const rows = msgs.map((m: any) => ({
          campaign_id,
          contact_id: phoneToContact.get(m.to) || null,
          telephone: m.to,
          statut: "sent",
          sent_at: new Date().toISOString(),
          operator_message_id: m.messageId
        }));

        const { error: insErr } = await db.from("campaign_messages").insert(rows);
        if (insErr) {
          await db.from("api_errors").insert({
            type: "campaign_messages_insert_failed",
            message: insErr.message,
            context: insErr,
            organization_id: camp.organization_id
          });
        } else {
          sent += msgs.length;
        }
      }
    }

    await db.from("campaigns").update({ statut: "sending", contacts_count: sent }).eq("id", campaign_id);

    return new Response(JSON.stringify({ success: true, sent, errors }), { headers });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
  }
});
