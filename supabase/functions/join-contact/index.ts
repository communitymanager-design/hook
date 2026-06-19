import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const h = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*"
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });

  try {
    const { prenom, nom, telephone, operateur, segment_id, organization_id } = await req.json();

    if (!telephone) {
      return new Response(JSON.stringify({ error: "Téléphone requis" }), { status: 400, headers: h });
    }

    const db = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: inserted, error } = await db.from("contacts").insert({
      prenom: prenom || null,
      nom: nom || null,
      telephone,
      operateur: operateur || "",
      segment_id: segment_id || null,
      organization_id: organization_id || null,
      statut: "actif"
    }).select("id").single();

    if (error) {
      return new Response(
        JSON.stringify({ error: error.code === "23505" ? "Ce numéro est déjà inscrit." : error.message }),
        { status: 400, headers: h }
      );
    }

    if (organization_id) {
      const contactName = [prenom, nom].filter(Boolean).join(" ") || telephone;
      await db.from("notifications").insert({
        user_id: organization_id,
        actor_id: null,
        type: "contact_qr",
        titre: "Nouveau contact via QR",
        message: contactName + " vient de rejoindre votre liste via QR code.",
        lu: false,
        lien: "/contacts",
        metadata: { contact_id: inserted?.id, segment_id }
      });
    }

    return new Response(JSON.stringify({ success: true }), { headers: h });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: h });
  }
});
