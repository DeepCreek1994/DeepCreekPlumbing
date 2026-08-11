/**
 * Deep Creek Plumbing — Enquiry Form Worker
 *
 * Receives the "Get a Quote" form POST from the website and sends
 * an email via Resend to the client's inbox.
 *
 * Required secrets (set via `wrangler secret put`):
 *   RESEND_API_KEY
 *   SUPABASE_SERVICE_KEY  — new, needed for enquiry logging + monitor checks
 */

const TO_EMAIL = ["info@deepcreekplumbing.com.au", "jwa7990@gmail.com"];
const FROM_EMAIL = "Deep Creek Plumbing <enquiries@deepcreekplumbing.com.au>";
const ALLOWED_ORIGIN = "https://deepcreekplumbing.com.au";

// Building Brain's Supabase project — same one Workshop itself uses.
const SUPABASE_URL = "https://qwlkpfrpzpswvedtcclj.supabase.co";
// Deep Creek Plumbing's row id in bb_clients — fixed per-worker constant.
const CLIENT_ID = "e8576821-e0d7-468c-9c18-9301cc1e8d82";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-BB-Monitor-Test",
  };
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Logs one row per real submission — makes real enquiry counts possible in
// Building Brain's monthly reports (see countEnquiries in
// building-brain-worker.js). source='monitor_test' rows are excluded from
// those counts. Errors are logged (visible via wrangler tail) but never
// block the real email send — that's still the actual job of this worker.
async function logEnquiry(source, env) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/bb_enquiries`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify([{ client_id: CLIENT_ID, source }]),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("logEnquiry failed:", res.status, errText);
    }
  } catch (e) {
    console.error("logEnquiry threw:", e.message);
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || ALLOWED_ORIGIN;

    // Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    let data;
    try {
      data = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const { name, phone, suburb, message, job, urgency } = data;

    // Basic validation — name and phone are required on the form
    if (!name || !phone) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // Building Brain's weekly proof-of-life check (see check_monitors mode
    // in building-brain-worker.js). Real name/phone validation above still
    // runs — that's genuinely part of what's being tested — but nothing
    // past this point ever emails Deep Creek or Jay. Logged as monitor_test
    // so it's excluded from real enquiry counts.
    const isMonitorTest = request.headers.get("X-BB-Monitor-Test") === "true";
    if (isMonitorTest) {
      await logEnquiry("monitor_test", env);
      return new Response(JSON.stringify({ success: true, test: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const isEmergency = urgency && urgency.toLowerCase().includes("emergency");

    const subject = isEmergency
      ? `🚨 EMERGENCY enquiry from ${name}`
      : `New enquiry from ${name}${job ? " — " + job : ""}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px;">
        <h2 style="margin-bottom: 4px;">${isEmergency ? "🚨 Emergency enquiry" : "New website enquiry"}</h2>
        <p style="color: #666; margin-top: 0;">Submitted via deepcreekplumbing.com.au</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <tr><td style="padding: 6px 0; font-weight: bold; width: 110px;">Name</td><td>${escapeHtml(name)}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: bold;">Phone</td><td><a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></td></tr>
          <tr><td style="padding: 6px 0; font-weight: bold;">Suburb</td><td>${escapeHtml(suburb) || "—"}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: bold;">Job type</td><td>${escapeHtml(job) || "—"}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: bold;">Urgency</td><td>${escapeHtml(urgency) || "—"}</td></tr>
        </table>
        <p style="margin-top: 16px; font-weight: bold;">Message</p>
        <p style="white-space: pre-wrap; background: #f5f5f5; padding: 12px; border-radius: 6px;">${escapeHtml(message) || "(no message provided)"}</p>
      </div>
    `;

    try {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: TO_EMAIL,
          subject: subject,
          html: html,
        }),
      });

      const resendData = await resendRes.json();

      if (!resendRes.ok) {
        return new Response(JSON.stringify({ success: false, error: resendData }), {
          status: 502,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }

      // Real enquiry — log it, but never let a logging hiccup block the
      // response the client's form is waiting on.
      await logEnquiry("contact_form", env);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: String(err) }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }
  },
};
