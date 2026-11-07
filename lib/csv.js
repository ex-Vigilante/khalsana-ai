// CSV export: UTF-8 with BOM so Excel shows Arabic correctly.
import { statusLabel } from "./seed.js";
import { channelLabel } from "./samples.js";

// Cells that start with = + - @ could run as formulas in Excel, so they get a leading apostrophe.
function cell(v) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

const HEAD = [
  "رقم الأوردر", "التاريخ", "الحالة", "القناة", "الاسم", "التليفون", "المحافظة", "العنوان",
  "المنتجات", "المجموع الفرعي", "الشحن", "الإجمالي عند الاستلام", "ملاحظات",
];

export function ordersToCsv(orders) {
  const rows = orders.map((o) => {
    const items = o.items
      .map((it) => `${it.qty} × ${it.name}${[it.size, it.color].filter(Boolean).length ? ` (${[it.size, it.color].filter(Boolean).join(" / ")})` : ""}`)
      .join(" | ");
    return [
      cell(o.id),
      cell(new Date(o.createdAt).toISOString().slice(0, 16).replace("T", " ")),
      cell(statusLabel(o.status)),
      cell(channelLabel(o.channel)),
      cell(o.name),
      /^01[0125]\d{8}$/.test(o.phone || "") ? `="${o.phone}"` : cell(o.phone), // keeps the leading zero in Excel
      cell(o.governorate),
      cell(o.address),
      cell(items),
      o.subtotal,
      o.shipping,
      o.total,
      cell(o.notes),
    ].join(",");
  });
  return "﻿" + [HEAD.map(cell).join(","), ...rows].join("\r\n");
}

export function downloadCsv(orders) {
  const blob = new Blob([ordersToCsv(orders)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `khalsana-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
