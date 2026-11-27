"use client";
import { useEffect, useState } from "react";

type Order = { id: string; amount_minor: number; currency: string; status: string; created_at: string; paid_at: string | null; experience_title: string; level_title: string };
type Summary = { total_orders: number; paid_orders: number; pending_orders: number; refunded_orders: number; paid_amount_minor: number };
const statusText: Record<string,string> = { paid: "已支付", pending: "待支付", refunded: "已退款", failed: "失败", cancelled: "已取消" };

export default function CreatorOrdersPage() {
  const [orders,setOrders] = useState<Order[]>([]);
  const [summary,setSummary] = useState<Summary | null>(null);
  const [message,setMessage] = useState("正在读取订单记录…");
  useEffect(() => {
    fetch("/api/creator/orders").then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error === "UNAUTHORIZED" ? "请先登录创作者账户。" : "暂时无法读取订单记录。");
      setOrders(data.orders || []);
      setSummary(data.summary || null);
      setMessage(data.paymentsEnabled ? "" : "真实支付尚未接入。此处只显示数据库中实际存在的订单，不会生成模拟收入。");
    }).catch(error => setMessage(error instanceof Error ? error.message : "读取失败"));
  }, []);
  return <main className="creatorShell"><a href="/creator" className="back">← 返回工作台</a><section className="creatorCard">
    <p className="eyebrow">CREATOR FINANCE</p><h1>订单记录</h1><p className="sub">只统计真实写入系统的订单；已支付金额按服务端订单状态计算，不代表已完成提现或结算。</p>
    {summary && <div className="orderStats"><div><span>订单总数</span><b>{summary.total_orders}</b></div><div><span>已支付订单</span><b>{summary.paid_orders}</b></div><div><span>已支付金额</span><b>¥{(Number(summary.paid_amount_minor)/100).toFixed(2)}</b></div><div><span>待支付 / 已退款</span><b>{summary.pending_orders} / {summary.refunded_orders}</b></div></div>}
    {orders.length ? <div className="orderList">{orders.map(order=><article className="orderRow" key={order.id}><div><b>{order.experience_title} · {order.level_title}</b><span>{new Date(order.created_at).toLocaleString()}</span></div><div><b>¥{(order.amount_minor/100).toFixed(2)}</b><span>{statusText[order.status] || order.status}</span></div></article>)}</div> : <div className="empty orderEmpty">目前没有订单记录。支付正式开通后，真实订单会显示在这里。</div>}
    {message && <p className="notice" role="status">{message}</p>}
    <p className="disclaimer">当前版本未接入微信支付或支付宝真实收款。不会展示虚构收入，也不能据此向体验者收款。</p>
  </section></main>;
}
