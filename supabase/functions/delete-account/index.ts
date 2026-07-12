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
    const { userId } = await req.json();
    if (!userId || typeof userId !== "string") {
      return json({ error: "Invalid request" }, 400);
    }

    // 1. Verify the caller is a signed-in admin. The browser sends the caller's
    //    session JWT as Authorization; resolve who they are with the anon client.
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

    // 2. Delete the target's related data (service role bypasses RLS).
    //    jobs.employer_id holds the auth user_id.
    const { data: jobs } = await admin
      .from("jobs")
      .select("id")
      .eq("employer_id", userId);

    for (const job of jobs ?? []) {
      await admin.from("job_tags").delete().eq("job_id", job.id);
      await admin.from("applications").delete().eq("job_id", job.id);
      await admin.from("job_views").delete().eq("job_id", job.id);
    }
    await admin.from("jobs").delete().eq("employer_id", userId);
    await admin.from("employers").delete().eq("user_id", userId);

    // 3. Delete the actual Supabase Auth user. This is the step the browser
    //    could never do, and the reason accounts lingered after "deletion".
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Auth user delete failed:", deleteError.message);
      return json({ error: "Failed to delete auth user" }, 500);
    }

    return json({ message: "ok" });
  } catch (err) {
    console.error("Function error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
