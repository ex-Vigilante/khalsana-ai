// Arabic text helpers. Everything here is length-preserving so that
// indexes found in the folded text can be used on the cleaned text.

export function digitsToLatin(s) {
  return String(s)
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
}

// Convert digits and the Arabic decimal separator (U+066B) to ASCII, then drop
// diacritics, tatweel and invisible direction marks. Only the removals change
// length, so use the folded text for matching and this one only for display.
export function clean(s) {
  return digitsToLatin(String(s))
    .replace(/٫/g, ".")
    .replace(/[ً-ٰٟـ​-‏‪-‮]/g, "")
    .replace(/\r/g, "");
}

// Fold spelling variants so "إسود" / "اسود" and "عمارة" / "عماره" compare equal.
export function fold(s) {
  return s
    .replace(/[A-Z]/g, (c) => c.toLowerCase()) // ASCII only, so string length never changes
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي");
}

export const prep = (s) => {
  const t = clean(s);
  return { t, n: fold(t) };
};

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cache = new Map();

// Regex that finds a keyword as a whole word, allowing the one-letter Arabic
// prefixes (ب ل و ف ك) and the article ال in front of it.
export function kwRegex(key, suffix = false) {
  const ck = key + (suffix ? "|s" : "");
  if (cache.has(ck)) return cache.get(ck);
  const k = fold(clean(key)).trim().split(/\s+/).map(esc).join("\\s+");
  const suf = suffix ? "(?:ين|ات|ان)?" : "";
  const re = new RegExp(
    `(?:^|[^\\p{L}\\p{N}])(?:[بلوفك]?ال|[بلوفك])?(${k})${suf}(?![\\p{L}\\p{N}])`,
    "u"
  );
  cache.set(ck, re);
  return re;
}

// Returns {start, end} of the keyword inside the folded text, or null.
export function findKw(n, key, suffix = false) {
  const m = kwRegex(key, suffix).exec(n);
  if (!m) return null;
  const start = m.index + m[0].indexOf(m[1]);
  return { start, end: m.index + m[0].length };
}

export const fmtNum = (n) => new Intl.NumberFormat("ar-EG").format(n);
export const fmtMoney = (n) => `${fmtNum(Math.round(n))} ج.م`;
