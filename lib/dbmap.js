// Maps database rows to the shapes the shared UI components already use.
export function orderFromRow(r) {
  return {
    id: String(r.id),
    messageId: r.message_id || null,
    createdAt: r.created_at,
    channel: r.messages?.channel || "manual",
    status: r.status,
    name: r.customer_name || "",
    phone: r.phone || "",
    governorate: r.governorate || "",
    address: r.address || "",
    items: Array.isArray(r.items) ? r.items : [],
    notes: r.notes || "",
    subtotal: r.subtotal,
    shipping: r.shipping,
    total: r.total,
  };
}

export function messageFromRow(r) {
  return {
    id: r.id,
    channel: r.channel,
    from: r.from_name || r.from_phone || "زبون",
    phone: r.from_phone || null,
    ts: Date.parse(r.received_at) || Date.now(),
    text: r.body,
    status: r.status,
    api: Boolean(r.external_id), // arrived through the WhatsApp API, so the API can answer it
    pasted: !r.external_id,
    named: Boolean(r.from_name),
    extraction: r.extraction || null,
  };
}

export const MESSAGE_COLS = "id, channel, external_id, from_phone, from_name, body, received_at, status, extraction";
export const ORDER_COLS = "*, messages(channel)";
export const MESSAGE_STATUSES = ["new", "extracted", "replied", "ignored"];
