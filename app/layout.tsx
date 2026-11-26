import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "赛前情报 | Football Prediction Agent",
  description: "面向中国用户的中英双语足球赛前情报与比赛预测工具 / Bilingual football pre-match intelligence and prediction tool"
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
