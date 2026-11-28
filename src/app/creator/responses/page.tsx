"use client";

import { useCallback, useEffect, useState } from "react";

type ResponseItem = {
  id: string;
  reaction: "heart" | "miss_you" | "hug";
  created_at: string;
  updated_at: string;
  read_at: string | null;
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
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingRead, setMarkingRead] = useState(false);
  const [message, setMessage] = useState("正在打开你的心意收件箱…");
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const response = await fetch("/api/creator/responses", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(response.status === 401 ? "请先登录创作者账户。" : "暂时无法读取回应。");
      setItems(Array.isArray(data.responses) ? data.responses : []);
      setUnreadCount(Number.isInteger(data.unreadCount) ? data.unreadCount : 0);
      setMessage("");
      setLastUpdated(new Date());
    } catch (error) {
      if (!quiet) setMessage(error instanceof Error ? error.message : "读取失败");
    } finally {
      if (!quiet) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, 30000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  async function markAllRead() {
    setMarkingRead(true);
    try {
      const response = await fetch("/api/creator/responses", { method: "PATCH" });
      const data = await response.json();
      if (!response.ok) throw new Error(response.status === 401 ? "登录状态已失效，请重新登录。" : "暂时无法更新已读状态。");
      await refresh(true);
      if (data.markedCount > 0) setMessage("已把这些心意收好 ♡");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    } finally {
      setMarkingRead(false);
    }
  }

  return <main className="creatorShell">
    <a href="/creator" className="back">← 返回工作台</a>
    <section className="creatorCard">
      <p className="eyebrow">LITTLE HEART NOTES</p>
      <h1>心意收件箱</h1>
      <p className="sub">体验者在每一关留下的回应，会安静地收在这里。回应不展示对方身份，只显示关卡和时间。</p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "16px 0" }}>
        <div>
          <small style={{ color: "#b49ca1" }}>{lastUpdated ? `最近更新：${lastUpdated.toLocaleTimeString()}` : "回应列表会自动更新"}</small>
          {unreadCount > 0 && <span style={{ display: "inline-block", marginLeft: 9, borderRadius: 20, padding: "3px 9px", background: "#ffe7ef", color: "#b35f7b", fontSize: 11 }}>新心意 {unreadCount}</span>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {unreadCount > 0 && <button type="button" disabled={markingRead} onClick={() => void markAllRead()} style={{ border: "1px solid #f0dfe4", borderRadius: 20, padding: "8px 14px", background: "#fff", color: "#a7657a" }}>{markingRead ? "收好中…" : "全部标为已读"}</button>}
        <button type="button" disabled={refreshing} onClick={() => void refresh()} style={{ border: "1px solid #f0dfe4", borderRadius: 20, padding: "8px 14px", background: "#fff8fa", color: "#a7657a", cursor: refreshing ? "wait" : "pointer" }}>
          {refreshing ? "更新中…" : "刷新收件箱 ↻"}
        </button>
        </div>
      </div>
      {message && <p className="notice" role="status">{message}</p>}
      {!message && items.length === 0 && <div className="empty">还没有收到回应。把作品分享出去，等待一份小小的心意吧 ♡</div>}
      {!message && items.length > 0 && <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
        {items.map(item => <article key={item.id} style={{ padding: 16, borderRadius: 16, border: item.read_at ? "1px solid #f0dfe4" : "1px solid #edbfd0", background: item.read_at ? "linear-gradient(135deg,#fff8fa,#fff)" : "linear-gradient(135deg,#fff0f5,#fff)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <span style={{ color: "#b87589", fontSize: 12 }}>第 {item.position} 关 · {item.level_title}</span>
            <b style={{ color: "#a7657a", fontSize: 14 }}>{labels[item.reaction].text}{!item.read_at && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 500 }}>· 新</span>}</b>
          </div>
          <p style={{ margin: "9px 0 5px", color: "#805d68", fontSize: 13 }}>{labels[item.reaction].detail}</p>
          <small style={{ color: "#b49ca1" }}>{item.experience_title} · {new Date(item.updated_at).toLocaleString()}</small>
          <div style={{ marginTop: 8 }}><a href={`/p/${item.slug}`} target="_blank" rel="noreferrer" style={{ color: "#b87589", fontSize: 11 }}>查看作品 ↗</a></div>
        </article>)}
      </div>}
      <p className="disclaimer">回应以匿名方式保存。每位体验者在同一关可更新自己的回应，不会公开其设备标识。页面打开时每 30 秒自动检查新回应，也可以手动刷新。体验者更新回应后会重新显示为未读。</p>
    </section>
  </main>;
}
