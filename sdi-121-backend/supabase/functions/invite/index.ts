// SDI 1-2-1 Review — "invite" Edge Function
// Sends a Supabase invitation email AND records the person in the org chart.
// Admin-only: it verifies the caller is an admin in org_members before doing anything.
//
// Deploy:  supabase functions deploy invite --no-verify-jwt
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
// Optional: supabase secrets set SITE_URL=https://sdi1-1templatetest.netlify.app

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, obj: unknown) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Use POST" });

  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
    if (!jwt) return json(401, { error: "Not signed in" });

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Identify the caller from their JWT
    const { data: caller, error: cErr } = await svc.auth.getUser(jwt);
    const callerEmail = caller?.user?.email?.toLowerCase();
    if (cErr || !callerEmail) return json(401, { error: "Invalid session" });

    // 2) Caller must be an admin in org_members
    const { data: me } = await svc.from("org_members")
      .select("role").eq("email", callerEmail).maybeSingle();
    if (!me || me.role !== "admin") return json(403, { error: "Admins only" });

    // 3) Read + validate the invite
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const full_name = String(body.full_name ?? "").trim();
    const manager_email = body.manager_email
      ? String(body.manager_email).trim().toLowerCase() : null;
    const role = body.role === "admin" ? "admin" : "member";
    const redirectTo = body.redirectTo || Deno.env.get("SITE_URL") || undefined;
    if (!email) return json(400, { error: "Email required" });

    // 4) Record them in the org chart (so access rules work immediately)
    const { error: upErr } = await svc.from("org_members")
      .upsert({ email, full_name, manager_email, role }, { onConflict: "email" });
    if (upErr) return json(500, { error: "Org update failed: " + upErr.message });

    // 5) Send the invitation email (a pre-existing user is fine — just added to org)
    const { error: invErr } = await svc.auth.admin.inviteUserByEmail(email, { redirectTo });
    let note = "invited";
    if (invErr) {
      if (/already|registered|exists/i.test(invErr.message)) note = "existing-user-added";
      else return json(500, { error: "Invite failed: " + invErr.message });
    }
    return json(200, { ok: true, note });
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) });
  }
});
