"use client";

import { useEffect, useState } from "react";

type ResponseItem = {
  id: string;
  reaction: "heart" | "miss_you" | "hug";
  created_at: string;
  updated_at: string;
  experience_title: string;
  slug: string;
  level_title: string;
  position: number;
};

const labels = {
  heart: { text: "心动 ♡", detail: "对方留下了一颗心动回应。" },
  miss_you: { text: "想你 ✨", detail: "对方说：想你。" },
  hug: { text: "抱抱 🫶", detail: "对方送来了一个抱抱。" },
};

export default function CreatorResponsesPage() {
  const [items, setItems] = useState<ResponseItem[]>([]);
  const [message, setMessage] = useState("正在打开你的心意收件箱…");
  useEffect(() => {
    let alive = true;
    fetch("/api/creator/responses", { cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(response.status === 401 ? "请先登录创作者账户。" : "暂时无法读取回应。");
        if (alive) {
          setItems(Array.isArray(data.responses) ? data.responses : []);
          setMessage("");
        }
      })
      .catch(error => { if (alive) setMessage(error instanceof Error ? error.message : "读取失败"); });
    return () => { alive = false; };
  }, []);

  return <main className="creatorShell">
    <a href="/creator" className="back">← 返回工作台</a>
    <section className="creatorCard">
      <p className="eyebrow">LITTLE HEART NOTES</p>
      <h1>心意收件箱</h1>
      <p className="sub">体验者在每一关留下的回应，会安静地收在这里。回应不展示对方身份，只显示关卡和时间。</p>
      {message && <p className="notice" role="status">{message}</p>}
      {!message && items.length === 0 && <div className="empty">还没有收到回应。把作品分享出去，等待一份小小的心意吧 ♡</div>}
      {!message && items.length > 0 && <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
        {items.map(item => <article key={item.id} style={{ padding: 16, borderRadius: 16, border: "1px solid #f0dfe4", background: "linear-gradient(135deg,#fff8fa,#fff)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <span style={{ color: "#b87589", fontSize: 12 }}>第 {item.position} 关 · {item.level_title}</span>
            <b style={{ color: "#a7657a", fontSize: 14 }}>{labels[item.reaction].text}</b>
          </div>
          <p style={{ margin: "9px 0 5px", color: "#805d68", fontSize: 13 }}>{labels[item.reaction].detail}</p>
          <small style={{ color: "#b49ca1" }}>{item.experience_title} · {new Date(item.updated_at).toLocaleString()}</small>
          <div style={{ marginTop: 8 }}><a href={`/p/${item.slug}`} target="_blank" rel="noreferrer" style={{ color: "#b87589", fontSize: 11 }}>查看作品 ↗</a></div>
        </article>)}
      </div>}
      <p className="disclaimer">回应以匿名方式保存。每位体验者在同一关可更新自己的回应，不会公开其设备标识。</p>
    </section>
  </main>;
}
