// Reads a plain-text streaming response and reports each chunk.
export async function streamText(url, body, onChunk, signal) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let msg = "حصلت مشكلة. جرّب تاني.";
    try {
      msg = (await res.json()).error || msg;
    } catch {}
    throw new Error(msg);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(dec.decode(value, { stream: true }));
  }
}

// Splits the status markers the server may add around the reply text.
export function parseReply(raw) {
  let text = raw;
  let unavailable = false;
  let interrupted = false;
  if (text.startsWith("⟦demo:unavailable⟧")) {
    unavailable = true;
    text = text.slice("⟦demo:unavailable⟧".length).replace(/^\n/, "");
  } else if ("⟦demo:unavailable⟧".startsWith(text.slice(0, 20)) && text.startsWith("⟦")) {
    text = ""; // marker still arriving
  }
  const i = text.indexOf("⟦interrupted⟧");
  if (i !== -1) {
    interrupted = true;
    text = text.slice(0, i).trimEnd();
  }
  return { text, unavailable, interrupted };
}
