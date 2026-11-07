// Rule-based order extractor for Egyptian-Arabic messages. This is the demo
// mode engine (no API key / AI failure) and also cross-checks AI output.
import { prep, findKw } from "./arabic.js";
import { normalizePhone, computeMissing } from "./order.js";
import {
  allKw, detectGovernorate, COLOR_ENTRIES, SIZE_RE, canonSize, matchColor, matchSize, findProducts, findMentions,
} from "./match.js";

const PHONE_FIND = /(?<![\d])(?:(?:\+|00)?20[\s-]*)?(0?1[0125](?:[\s-]?\d){8})(?!\d)/;
const PHONE_BAD = /(?<![\d])\d(?:[\s-]?\d){9,12}(?!\d)/;

const MARKERS = [
  "العنوان", "عنواني", "عنوان", "اسمي", "الاسم", "باسم", "رقمي", "رقم تليفوني", "رقم موبايلي", "تليفوني",
  "موبايلي", "واتساب", "ساكنه في", "ساكن في", "ساكنه", "address", "phone",
];
const MARKER_RE = new RegExp(`(?<![\\p{L}])(?:${MARKERS.join("|")})(?![\\p{L}])`, "gu");
const SEP_RE = /[\n،,;؛!?؟]+|\.(?=\s|$)/g;

const ADDRESS_WORDS = [
  "شارع", "ش", "عماره", "دور", "شقه", "ميدان", "حي", "منطقه", "مدينه", "كمبوند", "ساكن", "ساكنه", "عنوان",
  "العنوان", "عنواني", "محافظه", "قريه", "مركز", "بجوار", "امام", "بلوك", "مجاوره", "برج", "حاره", "خلف",
  "بالقرب", "قرب", "مبني", "فيلا", "عقار", "طريق", "address", "street",
];
const ADDR_START = /^(?:العنوان|عنواني|عنوان|ساكن[هة]?(?:\s+في)?|address)/u;
const PHONE_LABEL = /(?:^|\s)(?:رقمي|موبايلي|تليفوني|رقم\s+تليفوني|رقم\s+موبايلي|واتساب|ت|tel|phone)[\s:]*$/iu;
const NAME_START = /^(?:اسمي|الاسم|اسم|باسم|name)\s*[:\-]?\s*/u;

const STOP_NAME = new Set([
  "من", "في", "و", "عايز", "عايزه", "عاوز", "عاوزه", "محتاج", "محتاجه", "ساكن", "ساكنه", "رقمي", "عنواني",
  "العنوان", "ممكن", "لو", "بس", "عشان", "عايزين", "طلبت", "كنت", "حابب", "نفسي", "عندي",
]);

const QTY_WORDS = [
  ["واحد", 1], ["واحده", 1], ["اتنين", 2], ["اثنين", 2], ["اتنتين", 2], ["زوج", 2], ["قطعتين", 2],
  ["تلاته", 3], ["ثلاثه", 3], ["تلات", 3], ["ثلاث", 3], ["اربعه", 4], ["اربع", 4], ["خمسه", 5], ["خمس", 5],
  ["سته", 6], ["سبعه", 7], ["تمانيه", 8], ["ثمانيه", 8], ["تسعه", 9], ["عشره", 10], ["عشر", 10],
];

const COMPLAINT = /(وحش|زفت|مش\s+عاجب|مش\s+راضي|مشكله|اتاخر|متاخر|تاخير|مجاش|مجاتش|ماوصلش|وصلني\s+غلط|غلط|مكسور|استرجاع|ارجع|ارجاع|استبدل|مش\s+زي|شكوي|نصب|اسوء|سيء|مضايق|زعلان)/u;
const ORDER_VERB = /(عايز|عاوز|محتاج|احجز|اطلب|هاخد|هاخذ|اخد|ابعتلي|ابعت\s+لي|جيبلي|هاتلي|اوردر|طلب|حابب|نفسي|3ay|3aw|ayza|ayez|awez|awza)/u;
const QUESTION = /(بكام|بكم|سعر|كام|ثمن|متوفر|موجود|متاح|فيه|عندكم|عندك|مقاسات|ازاي|امتي|هل|price|how\s+much|ينفع|\?|؟)/u;
const PRICE_Q = /(بكام|بكم|سعر|كام\s|كام$|ثمن|price|how\s+much)/u;
const NOTE_RE = /(ملاحظ|ياريت|يفضل|هديه|تغليف|بعد\s+ال?ساعه|الصبح|بالليل|اتصل|كلموني|مستعجل|ضروري|قبل\s+ال)/u;

const hasWord = (n, words) => words.some((w) => findKw(n, w));

function cutPieces(t, n) {
  const cuts = [];
  let m;
  const sep = new RegExp(SEP_RE.source, "gu");
  while ((m = sep.exec(n))) cuts.push([m.index, m.index + m[0].length]);
  const mk = new RegExp(MARKER_RE.source, "gu");
  while ((m = mk.exec(n))) cuts.push([m.index, m.index]);
  cuts.sort((a, b) => a[0] - b[0]);
  const pieces = [];
  let pos = 0;
  for (const [s, e] of cuts) {
    if (s >= pos) pieces.push([pos, s]);
    pos = Math.max(pos, e);
  }
  pieces.push([pos, n.length]);
  return pieces
    .map(([s, e]) => ({ t: t.slice(s, e).trim(), n: n.slice(s, e).trim() }))
    .filter((p) => p.n.length > 0);
}

// Splits an item piece into sub-pieces at a standalone "و", "+" or "كمان".
function softSplit(p) {
  const re = /\s+(?:و|w)(?=\s|\d|[a-z])\s*|\s*\+\s*|\s+(?:وكمان|كمان|ومعاهم|ومعاه|معاه|معاها)\s+/gu;
  const parts = [];
  let pos = 0;
  let m;
  while ((m = re.exec(p.n))) {
    parts.push({ t: p.t.slice(pos, m.index), n: p.n.slice(pos, m.index) });
    pos = m.index + m[0].length;
  }
  parts.push({ t: p.t.slice(pos), n: p.n.slice(pos) });
  return parts.filter((x) => x.n.trim());
}

// Split a sub-piece that names several products at each later product mention.
function splitByProduct(sp, store) {
  const found = findMentions(sp.n, store);
  if (found.length < 2) return [sp];
  const out = [];
  let from = 0;
  for (let i = 1; i < found.length; i++) {
    const cut = found[i].start;
    out.push({ t: sp.t.slice(from, cut), n: sp.n.slice(from, cut) });
    from = cut;
  }
  out.push({ t: sp.t.slice(from), n: sp.n.slice(from) });
  return out;
}

function parseAttrs(sn, product) {
  let rest = sn;
  const blank = (s, e) => {
    rest = rest.slice(0, s) + " ".repeat(e - s) + rest.slice(e);
  };

  // colours
  const colorHits = [];
  for (const c of COLOR_ENTRIES) {
    for (const h of allKw(sn, c.v)) {
      if (colorHits.some((x) => h.start < x.end && h.end > x.start)) continue;
      colorHits.push({ ...h, canon: c.canon });
    }
  }
  colorHits.sort((a, b) => b.end - b.start - (a.end - a.start));
  const kept = [];
  for (const h of colorHits) if (!kept.some((x) => h.start < x.end && h.end > x.start)) kept.push(h);
  kept.sort((a, b) => a.start - b.start);
  const colors = [...new Set(kept.map((h) => h.canon))];
  kept.forEach((h) => blank(h.start, h.end));

  // size
  let size = null;
  const re = new RegExp(SIZE_RE.source, "gu");
  let m;
  while ((m = re.exec(rest))) {
    size = canonSize(m[1] || m[2]);
    blank(m.index, m.index + m[0].length);
    break;
  }
  const sizeLabel = /(?:مقاس|سايز|قياس|size)\s*(\d{2})(?!\d)/u.exec(rest);
  if (!size && sizeLabel) {
    size = sizeLabel[1];
    blank(sizeLabel.index, sizeLabel.index + sizeLabel[0].length);
  }
  if (!size && product) {
    const bare = /(?<![\d.a-z])(\d{2})(?![\d]|[a-z])/gu;
    let b;
    while ((b = bare.exec(rest))) {
      if (matchSize(product, b[1])) {
        size = b[1];
        blank(b.index, b.index + b[0].length);
        break;
      }
    }
  }

  // quantity
  let qty = null;
  const priceLike = /\d+\s*(?:جنيه|ج\b|egp|le\b)/gu;
  rest = rest.replace(priceLike, (s) => " ".repeat(s.length));
  const dm = /(?<![\d.a-z])(\d{1,2})(?![\d]|[a-z])/u.exec(rest);
  if (dm && Number(dm[1]) >= 1 && Number(dm[1]) <= 20) qty = Number(dm[1]);
  if (qty == null) {
    for (const [w, v] of QTY_WORDS) {
      if (findKw(rest, w)) {
        qty = v;
        break;
      }
    }
  }
  return { colors, size, qty };
}

export function extractRules(message, store) {
  // drop the voice-note header so the duration is not read as a quantity
  const body = String(message || "").slice(0, 2000).replace(/\u{1F3A4}[^\n]*?تفريغ[^:\n]*:/u, "");
  const { t, n } = prep(body);
  const warnings = [];

  /* phone */
  let phone = null;
  let phoneRange = null;
  const pm = PHONE_FIND.exec(n);
  if (pm) {
    phone = normalizePhone(pm[1]);
    phoneRange = [pm.index, pm.index + pm[0].length];
  } else {
    const bad = PHONE_BAD.exec(n);
    if (bad) {
      phoneRange = [bad.index, bad.index + bad[0].length];
      warnings.push("رقم التليفون شكله مش صح");
    }
  }
  let t2 = t;
  let n2 = n;
  if (phoneRange) {
    const [s, e] = phoneRange;
    t2 = t.slice(0, s) + "\n" + t.slice(e);
    n2 = n.slice(0, s) + "\n" + n.slice(e);
  }

  /* governorate */
  const geo = detectGovernorate(n2);
  const governorate = geo?.gov || null;

  /* pieces */
  const pieces = cutPieces(t2, n2);
  let name = null;
  const addrParts = [];
  const notes = [];
  const itemPieces = [];
  let inAddress = false;
  const pushAddr = (x) => {
    const v = x.replace(PHONE_LABEL, "").trim();
    if (v) addrParts.push(v);
  };

  for (const p of pieces) {
    const hasProduct = findProducts(p.n, store).length > 0;
    const nm = NAME_START.exec(p.n);
    if (nm && !name) {
      name = cleanName(p.t.slice(nm[0].length), p.n.slice(nm[0].length), store);
      continue;
    }
    if (ADDR_START.test(p.n)) {
      inAddress = true;
      pushAddr(p.t.replace(/^(?:العنوان|عنواني|عنوان|ساكن[ةه]?(?:\s+في)?|address)\s*[:\-]?\s*/iu, ""));
      continue;
    }
    if (!name) {
      const am = /(?:^|\s)انا\s+(.+)$/u.exec(p.n);
      if (am) {
        const off = am.index + am[0].length - am[1].length;
        name = cleanName(p.t.slice(off), am[1], store);
      }
    }
    if (hasProduct) {
      inAddress = false;
      itemPieces.push(p);
      continue;
    }
    if (p.n.startsWith("(")) {
      notes.push(p.t.replace(/^\(|\)$/g, ""));
      continue;
    }
    const addrish = detectGovernorate(p.n) || hasWord(p.n, ADDRESS_WORDS);
    if (addrish || (inAddress && !ORDER_VERB.test(p.n))) {
      inAddress = true;
      pushAddr(p.t);
      continue;
    }
    if (NOTE_RE.test(p.n)) {
      notes.push(p.t);
      continue;
    }
    itemPieces.push(p);
  }

  /* items */
  const items = [];
  let cur = null;
  let prev = null;
  for (const piece of itemPieces) {
    for (const sp0 of softSplit(piece)) {
      for (const sp of splitByProduct(sp0, store)) {
        const found = findProducts(sp.n, store)[0];
        const hasOwn = Boolean(found);
        if (found) cur = found.product;
        if (!cur) continue;
        const a = parseAttrs(sp.n, cur);
        const nothing = !hasOwn && !a.colors.length && !a.size && a.qty == null;
        if (nothing) continue;

        // a follow-up fragment ("مقاس L") fills gaps of the previous item
        if (!hasOwn && prev && prev.productId === cur.id && a.colors.length <= 1) {
          const c = a.colors[0] ? matchColor(cur, a.colors[0]) : null;
          const s = a.size ? matchSize(cur, a.size) : null;
          const conflict = (c && prev.color && c !== prev.color) || (s && prev.size && s !== prev.size);
          const fills = (c && !prev.color) || (s && !prev.size) || (a.qty != null && prev.qtyDefault);
          if (!conflict && fills && (!a.qty || prev.qtyDefault)) {
            if (c && !prev.color) prev.color = c;
            if (s && !prev.size) prev.size = s;
            if (a.qty != null && prev.qtyDefault) {
              prev.qty = a.qty;
              prev.qtyDefault = false;
            }
            continue;
          }
        }

        const colorList = a.colors.length ? a.colors : [null];
        for (const col of colorList) {
          let color = col ? matchColor(cur, col) : null;
          if (col && !color) warnings.push(`اللون ${col} مش متاح في ${cur.name}`);
          let size = a.size ? matchSize(cur, a.size) : null;
          if (a.size && !size) warnings.push(`المقاس ${a.size} مش متاح في ${cur.name}`);
          if (!size && cur.sizes.length === 1) size = cur.sizes[0];
          if (!color && cur.colors.length === 1) color = cur.colors[0];
          if (!hasOwn && !color && !(a.size && size) && a.qty == null) continue;
          const qty = Math.min(20, Math.max(1, a.qty ?? 1));
          const dup = items.find((x) => x.productId === cur.id && x.size === size && x.color === color);
          if (dup) {
            dup.qty = Math.min(20, dup.qty + qty);
            prev = dup;
          } else {
            const it = { productId: cur.id, name: cur.name, size, color, qty, qtyDefault: a.qty == null };
            items.push(it);
            prev = it;
          }
        }
      }
    }
  }
  const outItems = items.map(({ productId, name: nm, size, color, qty }) => {
    const p = store.products.find((x) => x.id === productId);
    return { productId, name: nm, size, color, qty, ...(p && p.available === false ? { unavailable: true } : {}) };
  });

  /* address */
  let address = addrParts
    .join("، ")
    .replace(/\s+/g, " ")
    .replace(/(?:^|\s)(?:ت|tel|تليفون|موبايل|رقم|واتس|واتساب|فون)[\s:]*$/iu, "")
    .replace(/^[\s:،\-]+|[\s:،\-]+$/g, "");
  if (!address) address = null;

  /* intent */
  const orderVerb = ORDER_VERB.test(n);
  const complaint = COMPLAINT.test(n);
  const priceQ = PRICE_Q.test(n);
  const question = QUESTION.test(n);
  let intent = "other";
  if (complaint && !(orderVerb && outItems.length && (phone || address))) intent = "complaint";
  else if ((priceQ || (question && !orderVerb)) && !(phone && address)) intent = "question";
  else if (outItems.length && (orderVerb || phone || address)) intent = "order";
  else if (orderVerb) intent = "order";
  else if (question) intent = "question";

  const noteText = [...notes, ...warnings].join("، ").slice(0, 200) || null;
  const confidence = {
    name: name ? 0.8 : 0,
    phone: phone ? 0.97 : 0,
    governorate: governorate ? (geo.conflict ? 0.55 : geo.explicit ? 0.95 : 0.85) : 0,
    address: address ? (address.length < 12 ? 0.5 : 0.75) : 0,
    items: outItems.length ? (items.some((i) => i.qtyDefault) ? 0.7 : 0.9) : 0,
  };
  const ex = { intent, name, phone, governorate, address, items: outItems, notes: noteText, confidence };
  ex.missing_fields = computeMissing(ex, store);
  return ex;
}

function cleanName(t, n, store) {
  const tw = t.trim().split(/\s+/);
  const nw = n.trim().split(/\s+/);
  const out = [];
  for (let i = 0; i < Math.min(4, tw.length); i++) {
    const w = nw[i];
    if (!w || STOP_NAME.has(w) || /[\d]/.test(w) || !/^[\p{L}]+$/u.test(tw[i])) break;
    out.push(tw[i]);
  }
  const name = out.join(" ");
  if (!name || name.length < 2) return null;
  if (findProducts(name, store).length) return null;
  return name;
}
