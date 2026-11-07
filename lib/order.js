// Order maths + validation shared by the client and the API routes.
// Anything that comes back from a model passes through validateExtraction().
import { clean, fold } from "./arabic.js";
import { GOV_NAMES, DEFAULT_FEE, DEFAULT_SHIPPING } from "./governorates.js";
import { DEFAULT_STORE } from "./catalog.js";
import { detectGovernorate, matchColor, matchSize, productByRef } from "./match.js";

export const INTENTS = ["order", "question", "complaint", "other"];
export const MAX_MESSAGE = 2000;
export const PHONE_RE = /^01[0125]\d{8}$/;

const squash = (s, max) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/* ---------- phone ---------- */
export function normalizePhone(raw) {
  if (raw == null) return null;
  let d = clean(String(raw)).replace(/\D/g, "");
  if (d.startsWith("0020")) d = d.slice(4);
  else if (d.startsWith("20") && d.length >= 12) d = d.slice(2);
  if (d.length === 10) d = "0" + d;
  return PHONE_RE.test(d) ? d : null;
}

// wa.me needs the international format without "+", e.g. 201012345678
export const waNumber = (phone) => (PHONE_RE.test(phone || "") ? "20" + phone.slice(1) : null);

/* ---------- totals ---------- */
export function shippingFor(store, gov) {
  if (!gov) return 0;
  const v = store?.shipping?.[gov];
  return Number.isFinite(v) ? v : DEFAULT_SHIPPING[gov] ?? DEFAULT_FEE;
}

// Price comes from the catalog; if the product was deleted we fall back to the
// price stored on the item. Use itemProblem() to flag that case, never trust 0.
export function itemPrice(store, it) {
  const p = store.products.find((x) => x.id === it.productId);
  return p ? p.price : Number.isFinite(it.price) ? it.price : 0;
}

// "deleted" (product no longer in settings), "unavailable" (marked sold out) or null.
export function itemProblem(store, it) {
  const p = store.products.find((x) => x.id === it.productId);
  if (!p) return "deleted";
  return p.available === false ? "unavailable" : null;
}

export function computeTotals(ex, store) {
  const subtotal = (ex.items || []).reduce((s, it) => s + itemPrice(store, it) * (Number(it.qty) || 0), 0);
  const shipping = ex.items?.length ? shippingFor(store, ex.governorate) : 0;
  return { subtotal, shipping, total: subtotal + shipping };
}

/* ---------- missing fields (Arabic labels used in the UI and replies) ---------- */
export function computeMissing(ex, store) {
  const miss = [];
  if (ex.intent && ex.intent !== "order") return miss;
  if (!ex.name) miss.push("الاسم");
  if (!ex.phone) miss.push("رقم التليفون");
  if (!ex.governorate) miss.push("المحافظة");
  if (!ex.address) miss.push("العنوان بالتفصيل");
  if (!ex.items?.length) miss.push("المنتجات المطلوبة");
  for (const it of ex.items || []) {
    const p = store.products.find((x) => x.id === it.productId);
    if (!p || p.available === false) continue; // reported separately as unavailable
    if (!it.size && p.sizes.length) miss.push(`المقاس (${p.name})`);
    if (!it.color && p.colors.length) miss.push(`اللون (${p.name})`);
  }
  return miss;
}

/* ---------- store settings ---------- */
export function validateStore(b) {
  if (b == null) return { value: DEFAULT_STORE };
  const bad = (error) => ({ error });
  if (typeof b !== "object" || Array.isArray(b)) return bad("إعدادات المتجر مش صحيحة.");
  if (!Array.isArray(b.products) || b.products.length === 0) return bad("لازم يكون فيه منتج واحد على الأقل في الإعدادات.");
  if (b.products.length > 40) return bad("أقصى عدد منتجات ٤٠.");
  const ids = new Set();
  const products = [];
  let n = 0;
  for (const p of b.products) {
    n++;
    if (!p || typeof p !== "object") return bad(`المنتج رقم ${n} مش صحيح.`);
    const id = squash(p.id, 20);
    const name = squash(p.name, 60);
    if (!/^[A-Za-z0-9_-]{1,20}$/.test(id) || ids.has(id)) return bad(`المنتج رقم ${n}: الكود مكرر أو مش صحيح.`);
    if (!name) return bad(`المنتج رقم ${n} من غير اسم. اكتب له اسم في الإعدادات.`);
    if (typeof p.price !== "number" || !Number.isFinite(p.price) || p.price < 0 || p.price > 1_000_000)
      return bad(`سعر «${name}» لازم يكون رقم من ٠ لـ ١٬٠٠٠٬٠٠٠.`);
    const list = (arr, max) =>
      Array.isArray(arr) && arr.every((x) => typeof x === "string") && arr.length <= max ? arr : null;
    const aliases = list(p.aliases ?? [], 8);
    const sizes = list(p.sizes ?? [], 12);
    const colors = list(p.colors ?? [], 12);
    if (!aliases) return bad(`«${name}»: أقصى عدد للأسماء التانية ٨.`);
    if (!sizes) return bad(`«${name}»: أقصى عدد للمقاسات ١٢.`);
    if (!colors) return bad(`«${name}»: أقصى عدد للألوان ١٢.`);
    ids.add(id);
    products.push({
      id,
      name,
      aliases: aliases.map((x) => squash(x, 30)).filter(Boolean),
      price: Math.round(p.price),
      sizes: sizes.map((x) => squash(x, 10)).filter(Boolean),
      colors: colors.map((x) => squash(x, 20)).filter(Boolean),
      available: p.available !== false,
    });
  }
  const shipping = { ...DEFAULT_SHIPPING };
  if (b.shipping != null) {
    if (typeof b.shipping !== "object" || Array.isArray(b.shipping)) return bad("جدول الشحن مش صحيح.");
    for (const g of GOV_NAMES) {
      const v = b.shipping[g];
      if (v === undefined) continue;
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 2000) return bad(`شحن ${g} لازم يكون رقم من ٠ لـ ٢٠٠٠.`);
      shipping[g] = Math.round(v);
    }
  }
  return {
    value: {
      name: squash(b.name, 40) || DEFAULT_STORE.name,
      signature: squash(b.signature, 120),
      products,
      shipping,
    },
  };
}

/* ---------- extraction (model output or demo output) ---------- */
const clamp01 = (x, d) => (typeof x === "number" && Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : d);

export function validateExtraction(raw, store) {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const intent = INTENTS.includes(r.intent) ? r.intent : "other";
  const name = squash(r.name, 60) || null;
  const phone = normalizePhone(r.phone);
  const address = squash(r.address, 200) || null;

  let governorate = null;
  if (typeof r.governorate === "string") {
    const g = squash(r.governorate, 40);
    governorate = GOV_NAMES.includes(g) ? g : detectGovernorate(fold(clean(g)))?.gov || null;
  }

  const items = [];
  for (const it of Array.isArray(r.items) ? r.items.slice(0, 12) : []) {
    if (!it || typeof it !== "object") continue;
    const p = productByRef(store, it.productId ?? it.name);
    if (!p) continue; // unknown product ids are dropped
    let size = matchSize(p, it.size);
    let color = p.colors.length ? matchColor(p, it.color ?? "") : null;
    if (!size && p.sizes.length === 1) size = p.sizes[0];
    if (!color && p.colors.length === 1) color = p.colors[0];
    const q = Math.round(Number(it.qty));
    const qty = Number.isFinite(q) ? Math.min(20, Math.max(1, q)) : 1;
    const dup = items.find((x) => x.productId === p.id && x.size === size && x.color === color);
    if (dup) dup.qty = Math.min(20, dup.qty + qty);
    else items.push({ productId: p.id, name: p.name, size, color, qty, ...(p.available === false ? { unavailable: true } : {}) });
  }

  const c = r.confidence && typeof r.confidence === "object" ? r.confidence : {};
  const out = {
    intent,
    name,
    phone,
    governorate,
    address,
    items,
    notes: squash(r.notes, 200) || null,
    confidence: {
      name: name ? clamp01(c.name, 0.6) : 0,
      phone: phone ? clamp01(c.phone, 0.8) : 0,
      governorate: governorate ? clamp01(c.governorate, 0.7) : 0,
      address: address ? clamp01(c.address, 0.6) : 0,
      items: items.length ? clamp01(c.items, 0.7) : 0,
    },
  };
  out.missing_fields = computeMissing(out, store);
  return out;
}
