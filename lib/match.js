// Dictionaries and matchers shared by the demo extractor and the server-side
// validation of AI output: governorates/areas, colours, sizes, products.
import { clean, fold, kwRegex, findKw } from "./arabic.js";
import { AREA_LIST } from "./governorates.js";

/* ---------- global keyword scan ---------- */
export function allKw(n, key, suffix = false) {
  const re = new RegExp(kwRegex(key, suffix).source, "gu");
  const out = [];
  let m;
  while ((m = re.exec(n))) {
    const start = m.index + m[0].indexOf(m[1]);
    out.push({ start, end: m.index + m[0].length });
    if (m[0].length === 0) re.lastIndex++;
  }
  return out;
}

/* ---------- governorate ---------- */
// Returns {gov, explicit, conflict, start} or null.
export function detectGovernorate(n) {
  const used = [];
  const hits = [];
  for (const a of AREA_LIST) {
    for (const h of allKw(n, a.name)) {
      if (used.some((u) => h.start < u.end && h.end > u.start)) continue;
      used.push(h);
      hits.push({ gov: a.gov, explicit: a.explicit, start: h.start });
    }
  }
  if (!hits.length) return null;
  hits.sort((a, b) => a.start - b.start);
  const areas = hits.filter((h) => !h.explicit);
  const best = areas[0] || hits[0];
  const conflict = hits.some((h) => h.gov !== best.gov);
  return { gov: best.gov, explicit: best.explicit, conflict, start: best.start };
}

/* ---------- colours ---------- */
const COLOR_VARIANTS = {
  "اسود": ["اسود", "soda", "سوداء", "سودا", "سوده", "black", "aswad", "eswed"],
  "ابيض": ["ابيض", "بيضاء", "بيضا", "بيضه", "white", "abyad"],
  "بيج": ["بيج", "beige", "bege", "بيجي"],
  "كحلي": ["كحلي", "navy", "ازرق غامق"],
  "رمادي": ["رمادي", "رصاصي", "جراي", "grey", "gray"],
  "زيتي": ["زيتي", "زيتوني", "olive"],
  "بني": ["بني", "brown", "قهوه", "قهوي"],
  "وردي": ["وردي", "بينك", "pink"],
  "احمر": ["احمر", "حمراء", "حمرا", "red"],
  "اخضر": ["اخضر", "خضراء", "خضرا", "green"],
  "ازرق": ["ازرق", "زرقاء", "زرقا", "blue"],
  "سماوي": ["سماوي", "لبني", "سمائي", "sky"],
  "عنابي": ["عنابي", "بوردو", "burgundy"],
  "اصفر": ["اصفر", "yellow"],
};
export const COLOR_ENTRIES = Object.entries(COLOR_VARIANTS).flatMap(([canon, vs]) =>
  vs.map((v) => ({ v: fold(v), canon: fold(canon) }))
);
const COLOR_MAP = new Map(COLOR_ENTRIES.map((e) => [e.v, e.canon]));

export function colorCanon(s) {
  const n = fold(clean(String(s))).trim().replace(/^ال(?=.{3})/, "");
  return COLOR_MAP.get(n) || n;
}

export function matchColor(product, raw) {
  const c = colorCanon(raw);
  if (!c) return null;
  for (const pc of product.colors) {
    if (colorCanon(pc) === c) return pc;
  }
  for (const pc of product.colors) {
    if (fold(clean(pc)).split(/\s+/).includes(c)) return pc;
  }
  return null;
}

/* ---------- sizes ---------- */
const SIZE_WORDS = [
  ["اكس اكس لارج", "XXL"], ["اكس لارج", "XL"], ["اكسل", "XL"], ["لارج", "L"],
  ["ميديم", "M"], ["ميدم", "M"], ["سمول", "S"], ["فري سايز", "FREE"], ["فري", "FREE"],
];
export const SIZE_RE = new RegExp(
  "(?<![a-z0-9])(xxxl|xxl|xl|l|m|s)(?![a-z0-9])|(?<![\\p{L}])(" +
    SIZE_WORDS.map(([w]) => fold(w).replace(/\s+/g, "\\s+")).join("|") +
    ")(?![\\p{L}])",
  "gu"
);

export function canonSize(s) {
  const n = fold(clean(String(s))).trim().replace(/\s+/g, " ");
  const w = SIZE_WORDS.find(([k]) => fold(k) === n);
  return w ? w[1] : n.toUpperCase();
}

export function matchSize(product, raw) {
  if (raw == null || raw === "") return null;
  const c = canonSize(raw);
  return product.sizes.find((sz) => canonSize(sz) === c) || null;
}

/* ---------- products ---------- */
export function productKeywords(p) {
  const first = fold(clean(p.name)).split(/\s+/)[0];
  const keys = [p.name, ...(p.aliases || [])];
  if (first && first !== "كتان" && first.length > 2) keys.push(first);
  return [...new Set(keys.map((k) => String(k).trim()).filter(Boolean))];
}

// All distinct products mentioned in the folded text, ordered by position.
export function findProducts(n, store) {
  const found = [];
  for (const p of store.products) {
    let best = null;
    for (const key of productKeywords(p)) {
      const h = findKw(n, key, true);
      if (h && (!best || h.start < best.start || (h.start === best.start && h.end > best.end))) best = h;
    }
    if (best) found.push({ product: p, start: best.start, end: best.end });
  }
  return found.sort((a, b) => a.start - b.start);
}

export function productByRef(store, ref) {
  if (ref == null) return null;
  const s = String(ref).trim();
  const byId = store.products.find((p) => p.id === s);
  if (byId) return byId;
  const f = fold(clean(s));
  return store.products.find((p) => fold(clean(p.name)) === f) || null;
}

// Every product mention (a product may appear twice), longest match wins on overlap.
export function findMentions(n, store) {
  const all = [];
  for (const p of store.products) {
    for (const key of productKeywords(p)) {
      for (const h of allKw(n, key, true)) all.push({ product: p, start: h.start, end: h.end });
    }
  }
  all.sort((a, b) => b.end - b.start - (a.end - a.start));
  const kept = [];
  for (const h of all) if (!kept.some((k) => h.start < k.end && h.end > k.start)) kept.push(h);
  return kept.sort((a, b) => a.start - b.start);
}
