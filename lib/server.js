// Server-only helpers: rate limiting, request reading, Groq calls (JSON + streaming).
// The API key is read from process.env only, never sent to the browser.
import "server-only";

const TIMEOUT_MS = 12000; // stay well inside the route maxDuration
export const MAX_TOKENS_REPLY = 700;
export const MAX_TOKENS_EXTRACT = 1200;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-120b";
// Markers the client strips from the streamed text and shows as a small note.
export const FALLBACK_PREFIX = "⟦demo:unavailable⟧\n";
export const INTERRUPTED = "\n⟦interrupted⟧";

/* ---------- rate limit (in-memory, per instance) ---------- */
const WINDOW_MS = 60_000;
const MAX_REQ = 10;
const GLOBAL_MAX = 60;
const hits = new Map();
let globalHits = [];

export function getIp(req) {
  const real = req.headers.get("x-real-ip");
  if (real && real.trim()) return real.trim();
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0].trim();
    if (first) return first;
  }
  return "local";
}

export function rateLimited(ip) {
  const now = Date.now();
  globalHits = globalHits.filter((t) => now - t < WINDOW_MS);
  if (globalHits.length >= GLOBAL_MAX) return true;
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_REQ) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  globalHits.push(now);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  }
  return false;
}

export const tooMany = () =>
  Response.json(
    { error: "بتبعت طلبات أسرع من المسموح في النسخة التجريبية. استنى كام ثانية وجرّب تاني." },
    { status: 429, headers: { "Retry-After": "30" } }
  );

export const bad = (msg, status = 400) => Response.json({ error: msg }, { status });

// Reads the body as a stream and stops as soon as it passes the byte cap,
// so a lying or missing Content-Length cannot make us buffer a huge body.
export async function readJson(req, maxBytes = 40_000) {
  const TOO_BIG = { error: "الطلب كبير أوي." };
  const len = Number(req.headers.get("content-length") || 0);
  if (len > maxBytes) return TOO_BIG;
  try {
    const reader = req.body?.getReader();
    if (!reader) return { error: "الطلب لازم يكون JSON صحيح." };
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        reader.cancel().catch(() => {});
        return TOO_BIG;
      }
      chunks.push(value);
    }
    const buf = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      buf.set(c, off);
      off += c.byteLength;
    }
    return { value: JSON.parse(new TextDecoder().decode(buf)) };
  } catch {
    return { error: "الطلب لازم يكون JSON صحيح." };
  }
}

// Browsers always send Origin (or at least Referer) on cross-site POSTs.
// If either is present its host must be ours. Requests with neither are
// non-browser clients, which the rate limiter handles.
export function sameOrigin(req) {
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0].trim().toLowerCase();
  if (req.headers.get("sec-fetch-site") === "cross-site") return false;
  for (const h of ["origin", "referer"]) {
    const v = req.headers.get(h);
    if (!v) continue;
    try {
      return new URL(v).host.toLowerCase() === host;
    } catch {
      return false;
    }
  }
  return true;
}

export const forbidden = () => Response.json({ error: "الطلب ده مش مسموح من موقع تاني." }, { status: 403 });

export const isLive = () => Boolean(process.env.GROQ_API_KEY);
const modelName = () => process.env.GROQ_MODEL || DEFAULT_MODEL;
const reasoning = (model) =>
  model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low", include_reasoning: false } : {};

// Links the client's abort signal and a timeout to one upstream controller.
function linkAbort(signal, ms = TIMEOUT_MS) {
  const upstream = new AbortController();
  const stop = () => upstream.abort();
  if (signal) {
    if (signal.aborted) stop();
    else signal.addEventListener("abort", stop, { once: true });
  }
  const timer = setTimeout(stop, ms);
  return { upstream, done: () => clearTimeout(timer) };
}

/* ---------- JSON call (extraction), no streaming ---------- */
// Returns the parsed JSON object, or throws. Caller falls back to demo mode.
export async function groqJson({ system, user, signal }) {
  const key = process.env.GROQ_API_KEY;
  const model = modelName();
  const { upstream, done } = linkAbort(signal);
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_completion_tokens: MAX_TOKENS_EXTRACT,
        temperature: 0.2,
        stream: false,
        response_format: { type: "json_object" },
        ...reasoning(model),
      }),
      signal: upstream.signal,
    });
    if (!res.ok) throw new Error(`Groq responded with status ${res.status}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) throw new Error("Groq returned no text");
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Groq returned non-object JSON");
    return parsed;
  } finally {
    done();
  }
}

/* ---------- streaming ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function* paced(text) {
  const parts = text.match(/\S+\s*|\s+/g) || [];
  for (const p of parts) {
    yield p;
    await sleep(14 + Math.random() * 22);
  }
}

// Parses an OpenAI-style SSE stream, calling onText for each delta.
// Resolves true if "[DONE]" was seen, false if the stream ended without it.
async function readGroqStream(body, onText) {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let done = false;

  const handle = (raw) => {
    const line = raw.trim();
    if (!line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (payload === "[DONE]") {
      done = true;
      return;
    }
    try {
      const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
      if (delta) onText(delta);
    } catch {
      /* ignore malformed lines */
    }
  };

  while (!done) {
    const { value, done: end } = await reader.read();
    if (end) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const l of lines) {
      handle(l);
      if (done) break;
    }
  }
  if (!done && buf) handle(buf);
  try {
    await reader.cancel();
  } catch {}
  return done;
}

export function streamAI({ system, messages, demo, signal }) {
  const enc = new TextEncoder();
  const key = process.env.GROQ_API_KEY;
  const live = Boolean(key);
  const model = modelName();
  const upstream = new AbortController();
  let cancelled = false;
  let closed = false;

  const stop = () => {
    cancelled = true;
    upstream.abort();
  };
  if (signal) {
    if (signal.aborted) stop();
    else signal.addEventListener("abort", stop, { once: true });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (t) => {
        if (cancelled || closed) return;
        try {
          controller.enqueue(enc.encode(t));
        } catch {
          cancelled = true;
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {}
      };

      let sent = false;
      let prefix = false;

      if (live) {
        // Give up on a stalled upstream so the demo fallback can run instead of hanging.
        const timer = setTimeout(() => upstream.abort(), TIMEOUT_MS);
        try {
          const res = await fetch(GROQ_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              messages: [{ role: "system", content: system }, ...messages],
              max_completion_tokens: MAX_TOKENS_REPLY,
              temperature: 0.7,
              stream: true,
              ...reasoning(model),
            }),
            signal: upstream.signal,
          });
          if (!res.ok || !res.body) {
            res.body?.cancel().catch(() => {});
            throw new Error(`Groq responded with status ${res.status}`);
          }
          const finished = await readGroqStream(res.body, (t) => {
            sent = true;
            send(t);
          });
          if (cancelled) return close();
          if (!sent) throw new Error("Groq returned no text");
          if (!finished) send(INTERRUPTED);
          return close();
        } catch (err) {
          if (cancelled) return close();
          console.error("Groq request failed:", err?.message || err);
          if (sent) {
            send(INTERRUPTED);
            return close();
          }
          prefix = true;
        } finally {
          clearTimeout(timer);
        }
      }

      try {
        if (prefix) send(FALLBACK_PREFIX);
        for await (const chunk of paced(demo())) {
          if (cancelled) break;
          send(chunk);
        }
      } finally {
        close();
      }
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
