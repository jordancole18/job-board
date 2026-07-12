import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = (Deno.env.get("APP_URL") || "https://associationcareers.realestate").replace(/\/$/, "");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const { userId, altEmail } = await req.json();
    if (!userId || typeof userId !== "string") {
      return json({ error: "Invalid request" }, 400);
    }

    // Verify the caller is a signed-in admin.
    const authHeader = req.headers.get("Authorization") || "";
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: callerEmployer } = await admin
      .from("employers")
      .select("is_admin")
      .eq("user_id", caller.id)
      .maybeSingle();
    if (!callerEmployer?.is_admin) return json({ error: "Forbidden" }, 403);

    // Look up the target account.
    const { data: { user: target }, error: getErr } = await admin.auth.admin.getUserById(userId);
    if (getErr || !target) return json({ error: "User not found" }, 404);

    if (target.email_confirmed_at) {
      return json({ error: "This account's email is already verified" }, 400);
    }

    let email = target.email ?? "";
    const alt = typeof altEmail === "string" ? altEmail.trim() : "";

    // If an alternate address was given, change the account's login email to it
    // first, so the verification link actually confirms this account.
    if (alt && alt.toLowerCase() !== email.toLowerCase()) {
      const { error: updateErr } = await admin.auth.admin.updateUserById(userId, { email: alt });
      if (updateErr) {
        const msg = updateErr.message || "";
        const alreadyUsed = /duplicate|already|registered|exists/i.test(msg);
        return json({
          error: alreadyUsed
            ? "That email address is already registered to another account."
            : `Could not update email: ${msg}`,
        }, 400);
      }
      email = alt;
    }

    if (!email) return json({ error: "Account has no email address" }, 400);

    // Resend the signup confirmation email (uses the project's Auth SMTP +
    // template). The anon client is what GoTrue's /resend expects.
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { error: resendErr } = await anon.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${APP_URL}/` },
    });
    if (resendErr) {
      return json({ error: resendErr.message }, 400);
    }

    return json({ message: "ok", email });
  } catch (err) {
    console.error("Function error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
