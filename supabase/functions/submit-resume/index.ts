import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RECAPTCHA_SECRET_KEY = Deno.env.get("RECAPTCHA_SECRET_KEY");
const RECAPTCHA_ACTION = "submit_resume";
// v3 scores run 0.0 (bot) to 1.0 (human); Google suggests 0.5 as the default cut-off.
const RECAPTCHA_MIN_SCORE = 0.5;

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

const ALLOWED_RESUME_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};
const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_REQUEST_BYTES = Math.ceil((MAX_RESUME_BYTES * 4) / 3) + 64 * 1024;

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
    if (!RECAPTCHA_SECRET_KEY) {
      console.error("RECAPTCHA_SECRET_KEY not configured");
      return json({ error: "Verification unavailable" }, 500);
    }

    // Cap the request before buffering it: 5 MB file as base64 plus form fields.
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > MAX_REQUEST_BYTES) {
      return json({ error: "File must be under 5 MB." }, 413);
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid request" }, 400);
    }
    if (!body || typeof body !== "object") {
      return json({ error: "Invalid request" }, 400);
    }
    const token = typeof body.captchaToken === "string" ? body.captchaToken : "";
    if (!token) {
      return json({ error: "captcha_required" }, 400);
    }

    const verifyBody = new URLSearchParams({ secret: RECAPTCHA_SECRET_KEY, response: token });
    const remoteIp = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for");
    if (remoteIp) verifyBody.set("remoteip", remoteIp.split(",")[0].trim());

    const verifyRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      body: verifyBody,
      signal: AbortSignal.timeout(5000),
    });
    if (!verifyRes.ok) {
      console.error("reCAPTCHA siteverify returned", verifyRes.status);
      return json({ error: "Verification unavailable" }, 502);
    }
    const verification = await verifyRes.json();
    if (
      !verification.success ||
      verification.action !== RECAPTCHA_ACTION ||
      typeof verification.score !== "number" ||
      verification.score < RECAPTCHA_MIN_SCORE
    ) {
      console.warn("reCAPTCHA rejected", {
        success: verification.success,
        action: verification.action,
        score: verification.score,
        errors: verification["error-codes"],
      });
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

    // The resume arrives base64-encoded and is uploaded here, after the CAPTCHA
    // has passed, so anonymous callers never get direct write access to storage.
    const resume = body.resume;
    let resumeBytes: Uint8Array | null = null;
    let resumeExt = "";
    if (resume) {
      resumeExt = Object.hasOwn(ALLOWED_RESUME_TYPES, resume.type) ? ALLOWED_RESUME_TYPES[resume.type] : "";
      if (!resumeExt || typeof resume.data !== "string") {
        return json({ error: "Only PDF, DOC, and DOCX files are allowed." }, 400);
      }
      // Base64 inflates by 4/3; reject oversize payloads before decoding them.
      if (resume.data.length > Math.ceil((MAX_RESUME_BYTES * 4) / 3) + 4) {
        return json({ error: "File must be under 5 MB." }, 400);
      }
      try {
        resumeBytes = Uint8Array.from(atob(resume.data), (c) => c.charCodeAt(0));
      } catch {
        return json({ error: "Invalid file" }, 400);
      }
      if (resumeBytes.length > MAX_RESUME_BYTES) {
        return json({ error: "File must be under 5 MB." }, 400);
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let resumePath: string | null = null;
    if (resumeBytes) {
      resumePath = `general-submissions/${crypto.randomUUID()}.${resumeExt}`;
      const { error: uploadError } = await supabase.storage
        .from("applications")
        .upload(resumePath, resumeBytes, { contentType: resume.type });
      if (uploadError) {
        console.error("Upload error:", uploadError.message);
        return json({ error: "Resume upload failed" }, 500);
      }
    }

    const { error } = await supabase.from("general_submissions").insert({
      first_name: firstName,
      last_name: lastName,
      email,
      phone: clean(body.phone, 50),
      looking_for: lookingFor,
      timeline: clean(body.timeline, 100),
      preferred_location: preferredLocation,
      resume_url: resumePath,
    });
    if (error) {
      console.error("Insert error:", error.message);
      // Don't leave the file behind if the row didn't save.
      if (resumePath) await supabase.storage.from("applications").remove([resumePath]);
      return json({ error: "Could not save submission" }, 500);
    }

    return json({ success: true });
  } catch (err) {
    console.error("submit-resume error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
