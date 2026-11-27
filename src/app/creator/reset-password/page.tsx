"use client";
import { FormEvent, useEffect, useState } from "react";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") || "");
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const endpoint = token ? "/api/auth/password-reset/confirm" : "/api/auth/password-reset/request";
      const payload = token ? { token, newPassword } : { email };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        const errors: Record<string, string> = {
          EMAIL_DELIVERY_NOT_CONFIGURED: "邮件服务尚未配置，暂时无法发送重置邮件。",
          INVALID_OR_EXPIRED_TOKEN: "链接无效或已过期，请重新申请密码重置。",
          INVALID_INPUT: token ? "新密码至少需要 10 位。" : "请输入有效邮箱地址。"
        };
        throw new Error(errors[data.error] || "操作暂时失败，请稍后重试。");
      }
      if (token) window.history.replaceState({}, "", "/creator/reset-password");
      setMessage(data.message || (token ? "密码已重置，请返回登录。" : "如果该邮箱已注册，重置说明将发送至邮箱。"));
      if (!token) setEmail("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "请求失败");
    } finally {
      setBusy(false);
    }
  }

  return <><meta name="referrer" content="no-referrer"/><main className="creatorShell"><a href="/creator" className="back">♡ 返回创作者工作台</a><section className="creatorCard"><p className="eyebrow">ACCOUNT RECOVERY</p><h1>{token ? "设置新密码" : "找回登录密码"}</h1><p className="sub">{token ? "设置新密码后，所有已登录设备都会退出，请重新登录。" : "输入注册邮箱，我们会发送一封限时密码重置邮件。"}</p><form className="form" onSubmit={submit}>{token ? <label>新密码<input type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={newPassword} onChange={event => setNewPassword(event.target.value)} placeholder="至少 10 位"/></label> : <label>注册邮箱<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com"/></label>}<button className="primary" disabled={busy}>{busy ? "请稍候…" : token ? "确认重置密码" : "发送重置邮件"}</button></form>{message && <p className="notice" role="status">{message}</p>}</section></main></>;
}
