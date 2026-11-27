import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "心意闯关 · Heart Studio", description: "把心意设计成一场逐关解锁的小小旅程。" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="zh-CN"><body>{children}</body></html>; }
