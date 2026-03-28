import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SMTP_HOST = Deno.env.get("SMTP_HOST");
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") || "465");
const SMTP_USER = Deno.env.get("SMTP_USER");
const SMTP_PASS = Deno.env.get("SMTP_PASS");
const SMTP_FROM = Deno.env.get("SMTP_FROM") || SMTP_USER;

// Shared secret to verify the request came from our DB trigger
const FUNCTION_SECRET = Deno.env.get("FUNCTION_SECRET") || "";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  try {
    // Verify the request came from our DB trigger via shared secret
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader !== `Bearer ${FUNCTION_SECRET}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { companyName, email } = await req.json();

    if (!companyName || !email || typeof companyName !== "string" || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Read the notification email from site_settings
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: setting } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "approval_notification_email")
      .single();

    const notifyEmail = setting?.value;
    if (!notifyEmail) {
      return new Response(JSON.stringify({ message: "No notification email configured, skipping" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      console.error("SMTP not configured");
      return new Response(JSON.stringify({ error: "Email service unavailable" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const safeCompanyName = escapeHtml(companyName.slice(0, 200));
    const safeEmail = escapeHtml(email.slice(0, 200));

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
      to: notifyEmail,
      subject: `New Employer Pending Approval: ${safeCompanyName}`,
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 500px; margin: 0 auto;">
          <div style="background: #38b653; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">Association Careers</h1>
          </div>
          <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="margin: 0 0 16px; color: #111827;">New Employer Registration</h2>
            <p style="color: #4b5563; line-height: 1.6;">
              A new employer has registered and is waiting for your approval.
            </p>
            <table style="width: 100%; margin: 16px 0; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; width: 120px;">Company</td>
                <td style="padding: 8px 0; color: #111827; font-weight: 600;">${safeCompanyName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Email</td>
                <td style="padding: 8px 0; color: #111827; font-weight: 600;">${safeEmail}</td>
              </tr>
            </table>
            <p style="color: #4b5563; line-height: 1.6;">
              Log in to the admin panel to approve or deny this request.
            </p>
          </div>
        </div>
      `,
    });

    await client.close();

    return new Response(JSON.stringify({ message: "Notification sent" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
