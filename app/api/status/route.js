import { PROD_CONFIGURED } from "@/lib/mode";
import { getAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

const has = (...names) => names.every((n) => Boolean(process.env[n]));

// Public: only whether the AI is live. Team members also get which integrations are configured
// (true/false, never the values) and the webhook URL to paste into Meta.
export async function GET(req) {
  const body = { live: has("GROQ_API_KEY") };
  if (PROD_CONFIGURED) {
    const access = await getAccess();
    if (access.state === "ok") {
      const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0].trim();
      const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
      const proto = local ? "http" : (req.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
      body.integrations = {
        database: true,
        serviceRole: has("SUPABASE_SERVICE_ROLE_KEY"),
        whatsappReceive: has("WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET", "SUPABASE_SERVICE_ROLE_KEY"),
        whatsappSend: has("WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"),
        ai: body.live,
        autoExtract: String(process.env.AUTO_EXTRACT || "").toLowerCase() === "true",
      };
      body.webhookUrl = host ? `${proto}://${host}/api/webhooks/whatsapp` : "";
      body.role = access.role;
      body.email = access.email;
    }
  }
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
