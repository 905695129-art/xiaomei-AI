"use client";

import { useEffect, useState } from "react";

type Purchase = {
  order_id: string;
  amount_minor: number;
  currency: string;
  paid_at: string | null;
  experience_slug: string;
  experience_title: string;
  level_id: string;
  level_position: number;
  level_title: string;
};

function money(minor: number, currency: string) {
  try { return new Intl.NumberFormat("zh-CN", { style: "currency", currency }).format(Number(minor) / 100); }
  catch { return "¥" + (Number(minor) / 100).toFixed(2); }
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        let response = await fetch("/api/buyer/purchases", { cache: "no-store" });
        if (response.status === 401) {
          // Establish an anonymous buyer identity only when this browser has none.
          const session = await fetch("/api/buyer/session", { method: "POST" });
          if (!session.ok) throw new Error("暂时无法建立体验者身份，请稍后再试。");
          response = await fetch("/api/buyer/purchases", { cache: "no-store" });
        }
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error === "SERVICE_NOT_CONFIGURED"
            ? "购买记录服务尚未配置，请稍后再试。"
            : "暂时无法读取购买记录。");
        }
        if (alive) setPurchases(Array.isArray(data.purchases) ? data.purchases : []);
      } catch (error) {
        if (alive) setMessage(error instanceof Error ? error.message : "读取失败，请稍后再试。");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  return <main className="publicShell buyerPurchasesShell">
    <header className="publicNav">
      <a href="/" className="publicBrand"><span>♡</span> 心意闯关</a>
      <a href="/creator" className="buyerCreatorLink">创作一份心意 ↗</a>
    </header>
    <section className="buyerPurchasesHero">
      <div className="publicHalo">♡</div>
      <p className="publicEyebrow">YOUR LITTLE TREASURES</p>
      <h1>我的已解锁心意</h1>
      <p>在这台设备上解锁的关卡，会安静地收藏在这里。</p>
    </section>
    {loading ? <div className="buyerPurchaseState">正在整理你的心意收藏…</div>
      : message ? <div className="buyerPurchaseState">{message}</div>
      : purchases.length === 0 ? <section className="buyerPurchaseEmpty">
        <span>✧</span><h2>这里还空空的</h2>
        <p>完成关卡解锁后，已购买的内容会显示在这里。当前版本尚未开通真实支付，因此不会产生新的购买记录。</p>
        <a href="/">返回首页</a>
      </section>
      : <section className="buyerPurchaseList">
        {purchases.map(item => <article className="buyerPurchaseCard" key={item.order_id}>
          <div className="buyerPurchaseIcon">♡</div>
          <div className="buyerPurchaseInfo">
            <span>{item.experience_title}</span>
            <h2>第 {item.level_position} 关 · {item.level_title}</h2>
            <small>{item.paid_at ? new Date(item.paid_at).toLocaleString() : "已完成解锁"}</small>
          </div>
          <div className="buyerPurchaseAmount">{money(item.amount_minor, item.currency)}</div>
          <a href={`/p/${encodeURIComponent(item.experience_slug)}?level=${encodeURIComponent(item.level_id)}`}>返回作品 ↗</a>
        </article>)}
      </section>}
    <footer className="publicFooter"><span>珍藏每一份认真准备的心意。</span><b>HEART STUDIO ♡</b><small>购买记录仅对当前浏览器的体验者身份可见</small></footer>
  </main>;
}
