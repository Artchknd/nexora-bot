import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nexora",
  description: "Discord 上的 AI 助理，只給自己和朋友使用。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
  lang="zh-TW"
  suppressHydrationWarning
  className={`${geistSans.variable} ${geistMono.variable}`}
>
      <body>{children}</body>
    </html>
  );
}
