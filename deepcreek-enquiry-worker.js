/**
 * Deep Creek Plumbing — Enquiry Form Worker
 *
 * Receives the "Get a Quote" form POST from the website and sends
 * an email via Resend to the client's inbox.
 *
 * Required secret (set via `wrangler secret put RESEND_API_KEY`
 * or the Cloudflare dashboard → this Worker → Settings → Variables & Secrets):
 *   RESEND_API_KEY
 *
 * Update the constants below before deploying:
 *   - TO_EMAIL: where enquiries should land (Holly's inbox + Jay's for monitoring)
 *   - FROM_EMAIL: must be on a domain verified in Resend
 *   - ALLOWED_ORIGIN: your live site's origin, for CORS
 */

const TO_EMAIL = ["info@deepcreekplumbing.com.au", "jwa7990@gmail.com"];
const FROM_EMAIL = "Deep Creek Plumbing <enquiries@deepcreekplumbing.com.au>";
const ALLOWED_ORIGIN = "https://deepcreekplumbing.com.au";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
