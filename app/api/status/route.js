export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ live: Boolean(process.env.GROQ_API_KEY) }, { headers: { "Cache-Control": "no-store" } });
}
