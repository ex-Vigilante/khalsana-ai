// Finds where the extracted values came from inside the original customer
// message, so the UI can mark them. Matching runs on a folded copy of the text
// (same length as the original), so every index maps straight back to it.
import { digitsToLatin, fold } from "./arabic.js";
import { AREA_LIST } from "./governorates.js";
import { allKw, findMentions, canonSize, colorCanon, COLOR_ENTRIES, SIZE_RE } from "./match.js";

export const HL_KINDS = {
  name: "الاسم",
  phone: "التليفون",
  area: "المنطقة والعنوان",
  items: "الصنف والمقاس واللون والكمية",
};

// Later kinds paint over earlier ones where they overlap.
const ORDER = ["area", "items", "name", "phone"];

const NUM_WORDS = { واحد: 1, واحده: 1, اتنين: 2, اثنين: 2, تلاته: 3, ثلاثه: 3, اربعه: 4, خمسه: 5 };

// Match the words of `str` one after another inside `n`; returns merged [start, end] ranges.
function sequence(n, str, minFirst = 3) {
  const toks = fold(digitsToLatin(String(str || ""))).split(/[\s,،\-:/\\.؛]+/).filter(Boolean);
  const hits = [];
  let pos = 0;
  for (const t of toks) {
    const idx = n.indexOf(t, pos);
    if (idx < 0) continue;
    if (!hits.length) {
      if (t.length < minFirst) continue;
    } else if (idx - pos > (t.length < 3 ? 3 : 16)) {
      continue;
    }
    hits.push([idx, idx + t.length]);
    pos = idx + t.length;
  }
  const out = [];
  for (const h of hits) {
    const last = out[out.length - 1];
    if (last && /^[\s,،\-:.]*$/.test(n.slice(last[1], h[0]))) last[1] = h[1];
    else out.push([...h]);
  }
  return out;
}

export function highlightSegments(text, ex, store) {
  const src = String(text ?? "");
  const n = fold(digitsToLatin(src));
  const paint = new Array(src.length).fill(null);
  const ranges = { area: [], items: [], name: [], phone: [] };
  const anchors = [];

  if (ex) {
    /* area: address words plus any area name of the chosen governorate */
    ranges.area.push(...sequence(n, ex.address));
    if (ex.governorate) {
      for (const a of AREA_LIST) {
        if (a.gov !== ex.governorate) continue;
        for (const h of allKw(n, a.name)) ranges.area.push([h.start, h.end]);
      }
    }

    /* items: product mention, colour, size, then the quantity next to them */
    const items = ex.items || [];
    const ids = new Set(items.map((i) => i.productId));
    for (const m of findMentions(n, store)) {
      if (ids.has(m.product.id)) {
        ranges.items.push([m.start, m.end]);
        anchors.push([m.start, m.end]);
      }
    }
    for (const it of items) {
      if (it.color) {
        const target = colorCanon(it.color);
        const variants = COLOR_ENTRIES.filter((e) => e.canon === target).map((e) => e.v);
        for (const v of variants.length ? variants : [fold(it.color)]) {
          for (const h of allKw(n, v)) {
            ranges.items.push([h.start, h.end]);
            anchors.push([h.start, h.end]);
          }
        }
      }
      if (it.size) {
        const want = canonSize(it.size);
        if (/^\d+$/.test(want)) {
          for (const m of n.matchAll(new RegExp(`(?<![\\d.])${want}(?!\\d)`, "g"))) {
            ranges.items.push([m.index, m.index + want.length]);
            anchors.push([m.index, m.index + want.length]);
          }
        } else {
          for (const m of n.matchAll(new RegExp(SIZE_RE.source, "gu"))) {
            if (canonSize(m[0]) === want) {
              ranges.items.push([m.index, m.index + m[0].length]);
              anchors.push([m.index, m.index + m[0].length]);
            }
          }
        }
      }
    }
    const qtys = new Set(items.map((i) => Number(i.qty)));
    const nearAnchor = (end) => anchors.some(([s]) => s >= end && s - end <= 14);
    const taken = (s, e) => ranges.area.some(([a, b]) => s < b && e > a);
    for (const m of n.matchAll(/(?<![\d.])(\d{1,2})(?!\d)/g)) {
      const e = m.index + m[0].length;
      if (qtys.has(Number(m[1])) && !taken(m.index, e) && nearAnchor(e)) ranges.items.push([m.index, e]);
    }
    for (const [w, v] of Object.entries(NUM_WORDS)) {
      if (!qtys.has(v)) continue;
      for (const h of allKw(n, w)) if (!taken(h.start, h.end) && nearAnchor(h.end)) ranges.items.push([h.start, h.end]);
    }

    /* name */
    if (ex.name) ranges.name.push(...sequence(n, ex.name, 2));

    /* phone: compare digits only, so spaces and dashes in the message do not matter */
    if (ex.phone) {
      const digits = [];
      for (let i = 0; i < src.length; i++) {
        const d = digitsToLatin(src[i]);
        if (/^\d$/.test(d)) digits.push([d, i]);
      }
      const flat = digits.map((d) => d[0]).join("");
      for (const want of [ex.phone, ex.phone.slice(1), "2" + ex.phone]) {
        const k = flat.indexOf(want);
        if (k >= 0) {
          ranges.phone.push([digits[k][1], digits[k + want.length - 1][1] + 1]);
          break;
        }
      }
    }
  }

  for (const kind of ORDER) {
    for (let [s, e] of ranges[kind]) {
      // take the article ال along with a product or colour word
      if (kind === "items" && n.slice(s - 2, s) === "ال" && !/[\p{L}\p{N}]/u.test(n[s - 3] || " ") && /\p{L}/u.test(n[s] || "")) s -= 2;
      for (let i = Math.max(0, s); i < Math.min(src.length, e); i++) paint[i] = kind;
    }
  }

  const segs = [];
  let start = 0;
  for (let i = 1; i <= src.length; i++) {
    if (i === src.length || paint[i] !== paint[start]) {
      segs.push({ text: src.slice(start, i), kind: paint[start] });
      start = i;
    }
  }
  return src ? segs : [];
}
