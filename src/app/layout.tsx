import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import { ThemeProvider } from "@/components/provider/theme-provider";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-noto-sans-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ระบบแจ้งซ่อมโฟล์คลิฟท์",
  description: "ระบบแจ้งซ่อมโฟล์คลิฟท์ผ่าน LINE",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={`${notoSansThai.variable} font-[var(--font-noto-sans-thai)]`}>
        <ThemeProvider defaultTheme="light" storageKey="forklift-theme">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
