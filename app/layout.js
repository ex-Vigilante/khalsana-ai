import { Cairo, Lalezar } from "next/font/google";
import AppProvider from "@/components/AppProvider";
import Shell from "@/components/Shell";
import "./globals.css";

const cairo = Cairo({ subsets: ["arabic", "latin"], display: "swap", variable: "--font-cairo" });
const lalezar = Lalezar({ subsets: ["arabic", "latin"], weight: "400", display: "swap", variable: "--font-lalezar" });

export const metadata = {
  title: { default: "خلّصانة - رسايل الزباين تدخل… والأوردرات تطلع خلّصانة", template: "%s | خلّصانة" },
  description:
    "خلّصانة بتحوّل رسايل الواتساب والماسنجر والإنستجرام لأوردرات جاهزة: استخراج بالذكاء الاصطناعي، رد جاهز، حساب الشحن، وطباعة ليبلات. نسخة تجريبية.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF5EA" },
    { media: "(prefers-color-scheme: dark)", color: "#101615" },
  ],
};

// Runs before first paint so the saved theme never flashes. Default is light.
const themeScript = `(function(){try{var t=localStorage.getItem('khalsana.theme');document.documentElement.dataset.theme=t==='dark'?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}})()`;

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" data-theme="light" suppressHydrationWarning className={`${cairo.variable} ${lalezar.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          تخطّى للمحتوى
        </a>
        <div id="app-root" className="app-shell">
          <AppProvider>
            <Shell>{children}</Shell>
          </AppProvider>
        </div>
      </body>
    </html>
  );
}
