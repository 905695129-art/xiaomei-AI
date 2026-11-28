import type { Metadata } from "next";
import PublicExperienceClient from "./PublicExperienceClient";
import { requireDb } from "@/lib/db";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const fallback: Metadata = {
    title: "一份专属心意 · 心意闯关",
    description: "有人为你准备了一段小小的心意旅程。打开分享链接，看看专属惊喜。",
  };
  try {
    const db = requireDb();
    const rows = await db`
      SELECT title, description, cover_url
      FROM experiences
      WHERE slug = ${slug} AND status = 'published'
      LIMIT 1
    `;
    if (!rows.length) return fallback;
    const title = String(rows[0].title || "一份专属心意");
    const description = String(rows[0].description || "有人为你准备了一段小小的心意旅程。每打开一扇门，都有一份认真准备的惊喜。").slice(0, 180);
    const pageTitle = title + " · 心意闯关";
    return {
      title: pageTitle,
      description,
      alternates: { canonical: `/p/${encodeURIComponent(slug)}` },
      openGraph: {
        type: "website",
        title: pageTitle,
        description,
        url: `/p/${encodeURIComponent(slug)}`,
        siteName: "Heart Studio",
        images: rows[0].cover_url ? [{ url: String(rows[0].cover_url), alt: title }] : undefined,
      },
      twitter: {
        card: rows[0].cover_url ? "summary_large_image" : "summary",
        title: pageTitle,
        description,
        images: rows[0].cover_url ? [String(rows[0].cover_url)] : undefined,
      },
    };
  } catch {
    return fallback;
  }
}

export default function PublicExperiencePage() {
  return <PublicExperienceClient />;
}
