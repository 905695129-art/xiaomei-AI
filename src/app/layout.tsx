import type { Metadata, Viewport } from "next";
import "./globals.css";

const metadataBase = (() => {
  try {
    const value = process.env.APP_URL;
    return value ? new URL(value) : undefined;
  } catch {
    return undefined;
  }
})();

export const metadata: Metadata = {
  metadataBase,
  applicationName: "心意闯关 · Heart Studio",
  title: "心意闯关 · Heart Studio",
  description: "把心意设计成一场逐关解锁的小小旅程。",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }]
  },
  appleWebApp: {
    capable: true,
    title: "心意闯关",
    statusBarStyle: "default"
  },
  openGraph: {
    title: "心意闯关 · Heart Studio",
    description: "有人为你准备了一段专属心意，来看看吧。",
    type: "website",
    locale: "zh_CN"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fff9f7"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
