import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SMTP_HOST = Deno.env.get("SMTP_HOST");
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") || "465");
const SMTP_USER = Deno.env.get("SMTP_USER");
const SMTP_PASS = Deno.env.get("SMTP_PASS");
const SMTP_FROM = Deno.env.get("SMTP_FROM") || SMTP_USER;

const FUNCTION_SECRET = Deno.env.get("FUNCTION_SECRET") || "";
// Public site origin for the "log in to renew" link. Falls back to a relative
// hint if the domain isn't configured yet.
const SITE_URL = (Deno.env.get("SITE_URL") || "").replace(/\/$/, "");

interface ReminderItem {
  id: string;
  employer_id: string;
  title: string;
  expires_at: string;
}
interface ExpiryItem {
  id: string;
  employer_id: string;
  title: string;
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(heading: string, bodyHtml: string): string {
  const dashboard = SITE_URL ? `${SITE_URL}/dashboard` : "your dashboard";
  const cta = SITE_URL
    ? `<p style="margin:20px 0 0;"><a href="${SITE_URL}/dashboard" style="background:#38b653;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;display:inline-block;">Go to your dashboard</a></p>`
    : `<p style="color:#4b5563;line-height:1.6;">Log in to ${dashboard} to manage this posting.</p>`;
  return `
    <div style="font-family: Inter, sans-serif; max-width: 520px; margin: 0 auto;">
      <div style="background:#38b653; padding:20px; text-align:center; border-radius:8px 8px 0 0;">
        <h1 style="color:white; margin:0; font-size:20px;">Association Careers</h1>
      </div>
      <div style="padding:24px; border:1px solid #e5e7eb; border-top:none; border-radius:0 0 8px 8px;">
        <h2 style="margin:0 0 16px; color:#111827;">${heading}</h2>
        ${bodyHtml}
        ${cta}
      </div>
    </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  try {
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader !== `Bearer ${FUNCTION_SECRET}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const reminders: ReminderItem[] = Array.isArray(body.reminders) ? body.reminders : [];
    const expiries: ExpiryItem[] = Array.isArray(body.expiries) ? body.expiries : [];

    if (reminders.length === 0 && expiries.length === 0) {
      return new Response(JSON.stringify({ message: "Nothing to send" }), {
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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Admin lead-alert recipient (same key as other admin notifications).
    const { data: setting } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "approval_notification_email")
      .single();
    const adminEmail: string | null = setting?.value || null;
    if (!adminEmail) {
      console.warn("approval_notification_email not set — admin lead alerts will be skipped");
    }

    // Resolve employer emails in one query (employer_id == employers.user_id).
    const employerIds = Array.from(
      new Set([...reminders, ...expiries].map((j) => j.employer_id).filter(Boolean)),
    );
    const employerMap = new Map<string, { email: string | null; company_name: string | null }>();
    if (employerIds.length > 0) {
      const { data: employers } = await supabase
        .from("employers")
        .select("user_id, email, company_name")
        .in("user_id", employerIds);
      for (const e of employers ?? []) {
        employerMap.set(e.user_id, { email: e.email, company_name: e.company_name });
      }
    }

    const client = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        tls: true,
        auth: { username: SMTP_USER, password: SMTP_PASS },
      },
    });

    let sent = 0;
    let failed = 0;
    // Per-recipient isolation: one bad address must not abort the batch.
    async function send(to: string, subject: string, html: string) {
      try {
        await client.send({ from: SMTP_FROM!, to, subject, html });
        sent++;
      } catch (err) {
        failed++;
        console.error(`Send failed to ${to}:`, err instanceof Error ? err.message : err);
      }
    }

    // --- Day-28 reminders ---
    for (const job of reminders) {
      const emp = employerMap.get(job.employer_id);
      const title = escapeHtml((job.title || "Your posting").slice(0, 200));
      const company = escapeHtml((emp?.company_name || "your association").slice(0, 200));

      if (emp?.email) {
        await send(
          emp.email,
          `Your job posting expires soon: ${title}`,
          shell(
            "Your posting expires in 2 days",
            `<p style="color:#4b5563;line-height:1.6;">Your posting <strong>${title}</strong> will be removed from Association Careers in about 2 days. If the role is still open, renew it to keep it live for another 30 days.</p>`,
          ),
        );
      }
      if (adminEmail) {
        await send(
          adminEmail,
          `Posting expiring soon: ${title} (${company})`,
          shell(
            "A posting is about to expire",
            `<p style="color:#4b5563;line-height:1.6;"><strong>${title}</strong> at <strong>${company}</strong> expires in ~2 days. If it goes unrenewed, the association may still be searching.</p>`,
          ),
        );
      }
    }

    // --- Day-30 expiry notices ---
    for (const job of expiries) {
      const emp = employerMap.get(job.employer_id);
      const title = escapeHtml((job.title || "Your posting").slice(0, 200));
      const company = escapeHtml((emp?.company_name || "an association").slice(0, 200));

      if (emp?.email) {
        await send(
          emp.email,
          `Your job posting has expired: ${title}`,
          shell(
            "Your posting has expired",
            `<p style="color:#4b5563;line-height:1.6;">Your posting <strong>${title}</strong> has reached 30 days and has been removed from Association Careers. If you're still hiring, you can renew it anytime to relist it for another 30 days.</p>`,
          ),
        );
      }
      if (adminEmail) {
        await send(
          adminEmail,
          `Lead: expired unfilled posting — ${title} (${company})`,
          shell(
            "Expired posting — possible recruiting lead",
            `<p style="color:#4b5563;line-height:1.6;"><strong>${title}</strong> at <strong>${company}</strong> reached 30 days without being renewed. This may be an association that's struggling to fill the role — a good moment to reach out about recruiting support.</p>`,
          ),
        );
      }
    }

    await client.close();

    return new Response(
      JSON.stringify({
        message: "Lifecycle emails processed",
        reminders: reminders.length,
        expiries: expiries.length,
        sent,
        failed,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
