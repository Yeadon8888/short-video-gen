import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VidClaw — AI 短视频生成",
  description: "VidClaw — 基于 Gemini × Sora，一句话生成爆款短视频脚本与成片",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
