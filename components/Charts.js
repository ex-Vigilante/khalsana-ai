"use client";
import { useMemo } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const nf = new Intl.NumberFormat("ar-EG");

function cssVar(name, fallback) {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

// One horizontal or vertical bar chart. `theme` is only used to re-read the CSS colours.
export default function BarChart({ labels, values, theme, horizontal = true, color = "--teal-bar", unit = "" }) {
  const { data, options } = useMemo(() => {
    const ink = cssVar("--ink", "#1A1F1E");
    const muted = cssVar("--muted", "#59605D");
    const grid = cssVar("--line", "#DDD2B8");
    const bar = cssVar(color, "#0F6E6A");
    const font = { family: getComputedStyle(document.body).fontFamily, size: 12 };
    const cat = { reverse: true, grid: { display: false }, ticks: { color: ink, font } };
    const val = {
      beginAtZero: true,
      grid: { color: grid },
      border: { display: false },
      ticks: { color: muted, font, precision: 0, callback: (v) => nf.format(v) },
    };
    return {
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: bar, borderRadius: 4, maxBarThickness: 26 }],
      },
      options: {
        indexAxis: horizontal ? "y" : "x",
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        plugins: {
          legend: { display: false },
          tooltip: {
            rtl: true,
            textDirection: "rtl",
            titleFont: font,
            bodyFont: font,
            callbacks: { label: (c) => ` ${nf.format(c.parsed[horizontal ? "x" : "y"])}${unit}` },
          },
        },
        // RTL page: categories/values start from the right side
        scales: horizontal
          ? { y: { ...cat, reverse: false, position: "right" }, x: { ...val, reverse: true } }
          : { x: { ...cat, reverse: true }, y: { ...val, position: "right" } },
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labels, values, theme, horizontal, color, unit]);

  return <Bar data={data} options={options} />;
}
