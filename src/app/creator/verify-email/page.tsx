"use client";
import { useEffect, useState } from "react";

export default function VerifyEmailPage() {
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("请点击下方按钮完成邮箱验证。");
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") || "");
  }, []);

  async function verify() {
    if (!token) { setMessage("验证链接缺少令牌，请返回工作台重新发送验证邮件。"); return; }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/verification/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error === "INVALID_OR_EXPIRED_TOKEN" ? "验证链接无效或已过期，请重新发送验证邮件。" : "验证暂时失败，请稍后重试。");
      setVerified(true);
      window.history.replaceState({}, "", "/creator/verify-email");
      setMessage(data.message || "邮箱验证成功。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "验证失败");
    } finally {
      setBusy(false);
    }
  }

  return <><meta name="referrer" content="no-referrer"/><main className="creatorShell"><a href="/creator" className="back">♡ 返回创作者工作台</a><section className="creatorCard"><p className="eyebrow">EMAIL VERIFICATION</p><h1>邮箱验证</h1><p className="sub">{message}</p>{!verified&&<button className="primary" disabled={busy||!token} onClick={verify}>{busy?"正在验证…":"确认验证邮箱"}</button>}{verified&&<a className="primary recoveryBack" href="/creator">返回工作台</a>}</section></main></>;
}
