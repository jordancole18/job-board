import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TURNSTILE_SECRET_KEY = Deno.env.get("TURNSTILE_SECRET_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Trim and cap a free-text field; returns null for blank optional values.
function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Fail closed: without a secret we can't tell a person from a bot.
    if (!TURNSTILE_SECRET_KEY) {
      console.error("TURNSTILE_SECRET_KEY not configured");
      return json({ error: "Verification unavailable" }, 500);
    }

    const body = await req.json();
    const token = typeof body.captchaToken === "string" ? body.captchaToken : "";
    if (!token) {
      return json({ error: "captcha_required" }, 400);
    }

    const verifyBody = new URLSearchParams({ secret: TURNSTILE_SECRET_KEY, response: token });
    const remoteIp = req.headers.get("cf-connecting-ip");
    if (remoteIp) verifyBody.set("remoteip", remoteIp);

    const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: verifyBody,
    });
    const verification = await verifyRes.json();
    if (!verification.success) {
      return json({ error: "captcha_failed" }, 400);
    }

    const firstName = clean(body.firstName, 100);
    const lastName = clean(body.lastName, 100);
    const email = clean(body.email, 254);
    const lookingFor = clean(body.lookingFor, 2000);
    const preferredLocation = clean(body.preferredLocation, 200);
    if (!firstName || !lastName || !email || !lookingFor || !preferredLocation) {
      return json({ error: "Missing required fields" }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Invalid email" }, 400);
    }

    // Uploads are anonymous and land in this prefix; reject anything else so a
    // caller can't point a submission at another file in the bucket.
    const resumeUrl = clean(body.resumeUrl, 300);
    if (resumeUrl && !/^general-submissions\/[A-Za-z0-9-]+\.[a-z0-9]{1,5}$/.test(resumeUrl)) {
      return json({ error: "Invalid resume path" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await supabase.from("general_submissions").insert({
      first_name: firstName,
      last_name: lastName,
      email,
      phone: clean(body.phone, 50),
      looking_for: lookingFor,
      timeline: clean(body.timeline, 100),
      preferred_location: preferredLocation,
      resume_url: resumeUrl,
    });
    if (error) {
      console.error("Insert error:", error.message);
      return json({ error: "Could not save submission" }, 500);
    }

    return json({ success: true });
  } catch (err) {
    console.error("submit-resume error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
