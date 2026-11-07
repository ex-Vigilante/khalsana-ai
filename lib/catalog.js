import { DEFAULT_SHIPPING } from "./governorates.js";

// Sample store «بيت الكتان»: a Cairo linen clothing brand. Editable in Settings.
export const DEFAULT_STORE = {
  name: "بيت الكتان",
  signature: "بيت الكتان - شكراً لثقتك 🤍",
  products: [
    { id: "p1", name: "طقم كتان قطعتين", aliases: ["طقم", "taqm", "set"], price: 890, sizes: ["S", "M", "L", "XL"], colors: ["أسود", "بيج", "كحلي"], available: true },
    { id: "p2", name: "فستان كتان طويل", aliases: ["فستان", "dress"], price: 650, sizes: ["S", "M", "L", "XL"], colors: ["بيج", "زيتي", "أسود"], available: true },
    { id: "p3", name: "قميص كتان رجالي", aliases: ["قميص", "shirt"], price: 480, sizes: ["M", "L", "XL", "XXL"], colors: ["أبيض", "سماوي", "كحلي"], available: true },
    { id: "p4", name: "بنطلون كتان واسع", aliases: ["بنطلون", "بنطلون واسع", "pantalon", "pants"], price: 520, sizes: ["S", "M", "L", "XL"], colors: ["بيج", "أسود", "رمادي"], available: true },
    { id: "p5", name: "جاكيت كتان خفيف", aliases: ["جاكيت", "jacket"], price: 780, sizes: ["M", "L", "XL"], colors: ["بيج", "زيتي"], available: true },
    { id: "p6", name: "عباية كتان", aliases: ["عباية", "abaya"], price: 950, sizes: ["52", "54", "56", "58"], colors: ["أسود", "كحلي", "بيج"], available: true },
    { id: "p7", name: "بلوزة كتان", aliases: ["بلوزة", "بلوزه", "blouse"], price: 340, sizes: ["S", "M", "L"], colors: ["أبيض", "وردي", "بيج"], available: true },
    { id: "p8", name: "شال كتان", aliases: ["شال", "ايشارب", "scarf", "shal", "shala"], price: 190, sizes: ["Free"], colors: ["بيج", "رمادي", "عنابي", "زيتي"], available: true },
    { id: "p9", name: "جلابية بيت", aliases: ["جلابية", "جلابيه"], price: 420, sizes: ["M", "L", "XL"], colors: ["رمادي", "كحلي"], available: true },
    { id: "p10", name: "شنطة كتان", aliases: ["شنطة", "شنطه", "bag"], price: 260, sizes: ["Free"], colors: ["بيج", "أسود"], available: false },
  ],
  shipping: { ...DEFAULT_SHIPPING },
};
