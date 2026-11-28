"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

type Level = { id: string; position: number; title: string; teaser: string | null; priceMinor: number; completed?: boolean };
type Experience = { slug: string; title: string; description: string | null; coverUrl: string | null; paymentQrUrl?: string | null; coverPosition?: "top" | "center" | "bottom"; currency: string; theme?: "rose" | "cream" | "lavender"; levels: Level[] };

function money(minor: number, currency: string) {
  try { return new Intl.NumberFormat("zh-CN", { style: "currency", currency }).format(minor / 100); }
  catch { return "¥" + (minor / 100).toFixed(2); }
}

export default function PublicExperiencePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [experience, setExperience] = useState<Experience | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Level | null>(null);
  const [closing, setClosing] = useState(false);
  const [notice, setNotice] = useState("");
  const [privateContent, setPrivateContent] = useState("");
  const [paymentQrUrl, setPaymentQrUrl] = useState<string | null>(null);
  const [confirmingTransfer, setConfirmingTransfer] = useState(false);
  const [checkingLevel, setCheckingLevel] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reaction, setReaction] = useState<string | null>(null);
  const [responseMessage, setResponseMessage] = useState("");
  const [sendingReaction, setSendingReaction] = useState(false);
  const responsePanelRef = useRef<HTMLElement | null>(null);
  const openerButtonRef = useRef<HTMLButtonElement | null>(null);
  function closeSelected() {
    if (!selected || closing) return;
    setClosing(true);
    window.setTimeout(() => {
      setSelected(null);
      setClosing(false);
    }, 180);
  }

  useEffect(() => {
    let alive = true;
    // Establish the anonymous buyer session before loading: archived experiences
    // are visible only to a buyer who already has a verified paid entitlement.
    async function loadExperienceAndPurchases() {
      try {
        // Create or reuse exactly one buyer session before any buyer-specific reads.
        const session = await fetch("/api/buyer/session", { method: "POST" });
        if (!session.ok) throw new Error("体验者身份暂时不可用，请稍后再试。");
        const response = await fetch(`/api/experiences/${encodeURIComponent(slug)}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(response.status === 404 ? "这份心意暂时不存在，或尚未发布。" : "暂时无法打开，请稍后再试。");
        if (!alive) return;
        setExperience(data.experience as Experience);

      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void loadExperienceAndPurchases();
    return () => { alive = false; };
  }, [slug]);

  const total = useMemo(() => experience?.levels.reduce((sum, level) => sum + level.priceMinor, 0) ?? 0, [experience]);

  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>(".journeyDialogClose")?.focus();
    }, 40);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSelected();
      if (event.key === "Tab") {
        const dialog = document.querySelector<HTMLElement>(".journeyDialog");
        const focusable = dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],[tabindex]:not([tabindex="-1"])');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (selected) window.requestAnimationFrame(() => openerButtonRef.current?.focus());
    };
  }, [selected?.id]);



  async function beginUnlock(level: Level, opener?: HTMLButtonElement) {
    if (opener) openerButtonRef.current = opener;
    setSelected(level);
    setReaction(null);
    setResponseMessage("");
    setPrivateContent("");
    setPaymentQrUrl(null);
    setCheckingLevel(true);
    setNotice("正在为你打开这一关…");
    try {
      const session = await fetch("/api/buyer/session", { method: "POST" });
      if (!session.ok) throw new Error("体验者身份暂时不可用，请稍后再试。");
      const response = await fetch(`/api/experiences/${encodeURIComponent(slug)}/levels/${encodeURIComponent(level.id)}`, { cache: "no-store" });
      const data = await response.json();
      if (response.ok) {
        setPrivateContent(typeof data.content === "string" ? data.content : "");
        setNotice("这一关已经为你打开，看看专属惊喜吧 ♡");
      } else if (response.status === 409 && data.error === "LEVEL_LOCKED") {
        setNotice("先完成前一关的小互动，就能打开这一关啦 ♡");
      } else if (response.status === 404 && data.error === "LEVEL_NOT_AVAILABLE") {
        setNotice("这一关暂时无法访问，可能已被创作者移除或作品已归档。");
      } else if (response.status === 402 && data.error === "PAYMENT_CONFIRMATION_REQUIRED") {
        setPaymentQrUrl(data.paymentQrUrl || null);
        setNotice("请先核对收款人和金额，完成转账后再自行确认。平台不会核验静态收款码的实际到账。");
      } else if (response.status === 409 && data.error === "PAYMENT_QR_NOT_CONFIGURED") {
        setNotice("创作者尚未配置本关收款码，暂时无法解锁。");
      } else if (response.status === 503) {
        setNotice("内容服务暂时未配置，请稍后再试。");
      } else {
        setNotice("暂时无法确认本关状态，请稍后再试。");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "暂时无法确认本关状态。");
    } finally {
      setCheckingLevel(false);
    }
  }

  useEffect(() => {
    if (!experience) return;
    const requestedLevel = new URLSearchParams(window.location.search).get("level");
    if (!requestedLevel) return;
    const level = experience.levels.find(item => item.id === requestedLevel);
    if (level) void beginUnlock(level);
  }, [experience, slug]);

  async function share() {
    const url = window.location.href;
    const isWeChat = /MicroMessenger/i.test(navigator.userAgent);
    try {
      if (navigator.share) {
        await navigator.share({ title: experience?.title ?? "心意闯关", text: "有人为你准备了一段专属心意，来看看吧。", url });
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
    if (isWeChat) {
      setNotice("微信内分享：请点击右上角「…」，选择发送给朋友或分享到朋友圈 ♡");
      return;
    }
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else {
        const input = document.createElement("textarea");
        input.value = url;
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        const ok = document.execCommand("copy");
        input.remove();
        if (!ok) throw new Error("COPY_FAILED");
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setNotice("暂时无法自动复制，请长按浏览器地址栏复制分享链接。");
    }
  }

  async function confirmSelfAttestedTransfer() {
    if (!selected || confirmingTransfer) return;
    setConfirmingTransfer(true);
    setNotice("正在记录你的自主确认…");
    try {
      const response = await fetch(`/api/experiences/${encodeURIComponent(slug)}/levels/${encodeURIComponent(selected.id)}/confirm-payment`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error === "LEVEL_LOCKED" ? "请先完成前一关。" : data.error === "PAYMENT_QR_NOT_CONFIGURED" ? "创作者尚未配置收款码。" : "暂时无法记录确认，请稍后再试。");
      const contentResponse = await fetch(`/api/experiences/${encodeURIComponent(slug)}/levels/${encodeURIComponent(selected.id)}`, { cache: "no-store" });
      const content = await contentResponse.json();
      if (!contentResponse.ok) throw new Error("确认记录已提交，但内容暂时无法打开，请刷新后重试。");
      setPrivateContent(typeof content.content === "string" ? content.content : "");
      setPaymentQrUrl(null);
      setNotice("已记录你的自主确认。这不是平台核验的支付成功记录。现在可以体验本关内容了 ♡");
      setExperience(current => current ? { ...current, levels: current.levels.map(level => level.id === selected.id ? { ...level, selfUnlocked: true } : level) } : current);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "确认失败，请稍后再试。");
    } finally {
      setConfirmingTransfer(false);
    }
  }

  async function sendReaction(label: string) {
    if (!selected || !experience || sendingReaction || checkingLevel) return;
    const reactionCode = label.startsWith("心动") ? "heart" : label.startsWith("想你") ? "miss_you" : "hug";
    setSendingReaction(true);
    setNotice("正在把这份回应送出…");
    try {
      const response = await fetch(`/api/experiences/${encodeURIComponent(slug)}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ levelId: selected.id, reaction: reactionCode, message: responseMessage })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error === "BUYER_SESSION_REQUIRED" ? "体验身份已失效，请刷新页面后再试。" : data.error === "LEVEL_LOCKED" ? "先完成前一关的小互动，就能打开这一关啦 ♡" : "暂时无法发送回应，请稍后再试。");
      setReaction(label);
      setExperience(current => current ? {
        ...current,
        levels: current.levels.map(level => level.id === selected.id ? { ...level, completed: true } : level)
      } : current);
      setNotice("这一关完成啦！下一关已经为你解锁，创作者也收到了你的回应 ♡");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "发送失败，请稍后再试。");
    } finally {
      setSendingReaction(false);
    }
  }

  if (loading) return <main className="publicShell"><div className="publicLoading">正在打开这份心意… ♡</div></main>;
  if (error || !experience) return <main className="publicShell"><section className="publicError"><div className="publicFlower">♡</div><h1>这份心意暂时找不到</h1><p>{error || "请检查分享链接是否正确。"}</p><a href="/">返回首页</a></section></main>;

  return <main className={`publicShell publicTheme-${experience.theme || "rose"}`}> 
    <header className="publicNav"><a href="/" className="publicBrand"><span>♡</span> 心意闯关</a><div className="publicNavActions"><a href="/purchases" className="buyerCreatorLink">历史购买记录</a><button onClick={share} className="shareButton">{copied ? "已复制链接 ✓" : "分享这份心意 ↗"}</button></div></header>
    <section className="publicHero">{experience.coverUrl&&!experience.coverUrl.startsWith("preset:")?<img className="publicCoverImage" src={experience.coverUrl} alt="这份心意的专属封面" style={{objectPosition:experience.coverPosition||"center"}}/>:experience.coverUrl?<div className={`publicCoverPreset publicCover-${experience.coverUrl.slice(7)}`}>♡</div>:null}
      <div className="publicHalo">♡</div>
      <p className="publicEyebrow">A LITTLE JOURNEY FOR YOU</p>
      <h1>{experience.title}</h1>
      <p className="publicDescription">{experience.description || "有人为你准备了一段小小的心意旅程。每打开一扇门，都有一份认真准备的惊喜。"}</p>
      <div className="publicMeta"><span>✦ {experience.levels.length} 份专属心意</span><span>♡ 每一关都是一次互动</span></div>
    </section>
    <section className="journeySection">
      <div className="journeyHeading"><div><p className="publicEyebrow">YOUR LITTLE JOURNEY</p><h2>一关一关，慢慢打开</h2></div><span>{experience.levels.length} LEVELS</span></div>
      <div className="paymentStatusNotice"><span>♡</span><div><b>这是一段为你准备的小旅程</b><p>慢慢体验每一关吧。每一关单独解锁；如创作者设置了收款码，请先核对信息并自行确认转账。平台不会核验静态收款码到账。</p></div></div>
      {experience.levels.length === 0 ? <div className="emptyJourney">这段旅程还在准备中，稍后再来看看吧。</div> :
        <div className="journeyList">{experience.levels.map((level, index) => <article className={selected?.id === level.id ? "journeyCard activeJourney" : "journeyCard"} key={level.id}>
          <div className="journeyNumber">{String(level.position || index + 1).padStart(2, "0")}</div>
          <div className="journeyCopy"><span className="journeyLabel">A LITTLE SECRET</span><h3>{level.title}</h3><p>{level.teaser || "一份为你准备的小惊喜，打开后就能看到更多。"}</p></div>
          <div className="journeyAction"><strong>{money(level.priceMinor, experience.currency || "CNY")}</strong><small className="levelPriceCaption">{level.completed ? "已完成 ♡" : "本关解锁金额"}</small><button disabled={checkingLevel || (index > 0 && !experience.levels.slice(0, index).every(previous => previous.completed))} onClick={event => beginUnlock(level, event.currentTarget)}>{checkingLevel && selected?.id === level.id ? "打开中…" : level.completed ? "再次回味这一关" : index > 0 && !experience.levels.slice(0, index).every(previous => previous.completed) ? "完成前一关后解锁" : "查看本关"} <span>{level.completed ? "✓" : index > 0 && !experience.levels.slice(0, index).every(previous => previous.completed) ? "🔒" : "♡"}</span></button></div>
        </article>)}</div>}
      <div className="journeyTotal"><span>每一关，都有一份专属的小惊喜</span><strong>慢慢打开 ♡</strong></div>
    </section>
    {selected && <div className={closing ? "journeyModalBackdrop closing" : "journeyModalBackdrop"} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeSelected(); }}>
      <section ref={responsePanelRef} className="journeyDialog" role="dialog" aria-modal="true" aria-labelledby="journeyDialogTitle" aria-describedby="journeyDialogDescription">
        <button type="button" className="journeyDialogClose" onClick={closeSelected} aria-label="关闭这份心意">×</button>
        <div className="journeyDialogGlow" aria-hidden="true" />
        <div className="journeyDialogSeal">♡</div>
        <p className="journeyDialogEyebrow">A LITTLE SECRET FOR YOU</p>
        <h2 id="journeyDialogTitle">{selected.title}</h2>
        <p className="journeyDialogDescription" id="journeyDialogDescription">{selected.teaser || "一份为你准备的小惊喜，打开后就能看到更多。"}</p>
        <div className="journeyDialogPrice">{money(selected.priceMinor, experience.currency || "CNY")} <span>心意参考</span></div>
        <div className="journeyDialogStatus" aria-live="polite">{checkingLevel ? <><span className="journeySpinner" />正在为你打开这一关…</> : notice || "慢慢来，看看这份心意为你准备了什么。"}</div>
        {paymentQrUrl && <div className="privateContentView" style={{textAlign:"center"}}><p>请使用对应支付应用扫码，并自行核对收款人、金额和备注。</p><img src={paymentQrUrl} alt="创作者提供的收款码" style={{maxWidth:240,maxHeight:240,objectFit:"contain",background:"#fff",padding:12,borderRadius:16}}/><p style={{fontSize:12,opacity:.75}}>平台无法核验此收款码的到账情况。请勿向陌生收款人转账。</p><button type="button" className="journeyDialogDone" disabled={confirmingTransfer} onClick={()=>void confirmSelfAttestedTransfer()}>{confirmingTransfer?"正在确认…":"我已按约定完成转账，继续解锁"}</button></div>}
        {paymentQrUrl && <div className="privateContentView" style={{textAlign:"center"}}><p>请使用对应支付应用扫码，并自行核对收款人和金额。</p><img src={paymentQrUrl} alt="创作者提供的收款码" style={{maxWidth:240,maxHeight:240,objectFit:"contain",background:"#fff",padding:12,borderRadius:16}}/><p style={{fontSize:12,opacity:.75}}>平台无法核验此收款码的到账情况。请勿向陌生收款人转账。</p><button type="button" className="journeyDialogDone" disabled={confirmingTransfer} onClick={()=>void confirmSelfAttestedTransfer()}>{confirmingTransfer?"正在确认…":"我已按约定完成转账，继续解锁"}</button></div>}
        {privateContent && <div className="privateContentView">{privateContent}</div>}
        <div className="heartReaction journeyDialogReactions">
          <span>此刻，你想给这份心意什么回应？</span>
          <label className="journeyResponseNote"><span>也可以留一句话（选填）</span><textarea value={responseMessage} maxLength={500} disabled={checkingLevel || sendingReaction} onChange={event => setResponseMessage(event.target.value)} placeholder="写一句此刻想说的话…" rows={3}/><small>{Array.from(responseMessage).length}/500</small></label>
          <div>{["心动 ♡","想你 ✨","抱抱 🫶"].map(item => <button type="button" key={item} disabled={checkingLevel || sendingReaction} className={reaction === item ? "chosenReaction" : ""} onClick={() => void sendReaction(item)}>{sendingReaction ? "发送中…" : item}</button>)}</div>
          {reaction && <small aria-live="polite">收到你的回应：{reaction}。创作者已经可以在心意收件箱里看到它。</small>}
        </div>
        <button type="button" className="journeyDialogDone" onClick={closeSelected}>把这份心意收好 ♡</button>
        <p className="journeyDialogFootnote">一段专属互动体验 · Heart Studio</p>
      </section>
    </div>}
    <footer className="publicFooter"><span>用一点点心意，开启一段小旅程。</span><b>HEART STUDIO ♡</b><small>一段专属互动体验 · Heart Studio</small></footer>
  </main>;
}
