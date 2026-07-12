import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Invoked from the admin UI in the browser, so it needs CORS headers.
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
    // Verify the caller is a signed-in admin.
    const authHeader = req.headers.get("Authorization") || "";
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return json({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: callerEmployer } = await admin
      .from("employers")
      .select("is_admin")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (!callerEmployer?.is_admin) {
      return json({ error: "Forbidden" }, 403);
    }

    // Page through all auth users and return only the fields the admin UI needs.
    const perPage = 1000;
    const users: {
      id: string;
      email: string | null;
      email_confirmed_at: string | null;
      created_at: string;
      last_sign_in_at: string | null;
    }[] = [];

    for (let page = 1; ; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.error("listUsers failed:", error.message);
        return json({ error: "Failed to list users" }, 500);
      }
      for (const u of data.users) {
        users.push({
          id: u.id,
          email: u.email ?? null,
          email_confirmed_at: u.email_confirmed_at ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
        });
      }
      if (data.users.length < perPage) break;
    }

    return json({ users });
  } catch (err) {
    console.error("Function error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
