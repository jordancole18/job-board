import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SMTP_HOST = Deno.env.get("SMTP_HOST");
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") || "465");
const SMTP_USER = Deno.env.get("SMTP_USER");
const SMTP_PASS = Deno.env.get("SMTP_PASS");
const SMTP_FROM = Deno.env.get("SMTP_FROM") || SMTP_USER;

// Public site URL, used to build the sign-in / reset links in the email.
const APP_URL = (Deno.env.get("APP_URL") || "https://associationcareers.realestate").replace(/\/$/, "");

// Unlike the notify-* trigger functions, this one is invoked from the browser
// during signup, so it must return CORS headers.
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
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return json({ error: "Invalid request" }, 400);
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Only email addresses that actually belong to a registered account.
    // This keeps the endpoint from being used to spam arbitrary inboxes and
    // means we never tell a non-account-holder anything. The signup UI stays
    // generic ("check your email") regardless of the outcome here.
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: employer } = await supabase
      .from("employers")
      .select("email")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (!employer?.email) {
      // No such account — do nothing (still return a generic 200).
      return json({ message: "ok" });
    }

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      console.error("SMTP not configured");
      return json({ error: "Email service unavailable" }, 500);
    }

    const signInUrl = `${APP_URL}/auth`;
    const resetUrl = `${APP_URL}/auth?mode=forgot`;

    const client = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        tls: true,
        auth: {
          username: SMTP_USER,
          password: SMTP_PASS,
        },
      },
    });

    await client.send({
      from: SMTP_FROM!,
      to: employer.email,
      subject: "You already have an account",
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 500px; margin: 0 auto;">
          <div style="background: #38b653; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">Association Careers</h1>
          </div>
          <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="margin: 0 0 16px; color: #111827;">You already have an account</h2>
            <p style="color: #4b5563; line-height: 1.6;">
              Someone just tried to create an account with this email address, but
              you already have one with us. There's no need to sign up again &mdash;
              just sign in below. If you've forgotten your password, you can reset it.
            </p>
            <div style="margin: 24px 0;">
              <a href="${signInUrl}" style="display: inline-block; background: #38b653; color: white; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600; margin-right: 8px;">Sign In</a>
              <a href="${resetUrl}" style="display: inline-block; background: #f3f4f6; color: #111827; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">Reset Password</a>
            </div>
            <p style="color: #9ca3af; line-height: 1.6; font-size: 13px;">
              If this wasn't you, you can safely ignore this email &mdash; no changes
              have been made to your account.
            </p>
          </div>
        </div>
      `,
    });

    await client.close();

    return json({ message: "ok" });
  } catch (err) {
    console.error("Function error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
