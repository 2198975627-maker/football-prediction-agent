import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Football Prediction Agent",
  description: "Security-first football pre-match intelligence agent skeleton"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
