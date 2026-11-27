"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Level = { id: string; position: number; title: string; teaser: string | null; priceMinor: number };
type Experience = { slug: string; title: string; description: string | null; coverUrl: string | null; coverPosition?: "top" | "center" | "bottom"; currency: string; theme?: "rose" | "cream" | "lavender"; levels: Level[] };

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
  const [notice, setNotice] = useState("");
  const [privateContent, setPrivateContent] = useState("");
  const [checkingLevel, setCheckingLevel] = useState(false);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

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

        // Load this browser's purchases only after the session cookie is established.
        const purchasesResponse = await fetch("/api/buyer/purchases", { cache: "no-store" });
        if (purchasesResponse.ok) {
          const purchasesData = await purchasesResponse.json();
          if (alive && Array.isArray(purchasesData.purchases)) {
            setUnlockedIds(new Set(purchasesData.purchases.map((item: { level_id: string }) => item.level_id)));
          }
        }
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



  async function beginUnlock(level: Level) {
    setSelected(level);
    setPrivateContent("");
    setCheckingLevel(true);
    setNotice("正在确认这台设备是否已经解锁过本关…");
    try {
      const session = await fetch("/api/buyer/session", { method: "POST" });
      if (!session.ok) throw new Error("体验者身份暂时不可用，请稍后再试。");
      const response = await fetch(`/api/experiences/${encodeURIComponent(slug)}/levels/${encodeURIComponent(level.id)}`, { cache: "no-store" });
      const data = await response.json();
      if (response.ok) {
        setPrivateContent(typeof data.content === "string" ? data.content : "");
        setUnlockedIds(current => new Set(current).add(level.id));
        setNotice("已确认解锁成功。这是你此前购买的专属内容。");
      } else if (response.status === 403 && data.error === "PURCHASE_REQUIRED") {
        setNotice("你还没有解锁这一关。当前版本尚未开通合规支付，因此不会向你收款，也不会创建订单。");
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
    try {
      if (navigator.share) {
        await navigator.share({ title: experience?.title ?? "心意闯关", text: "有人为你准备了一段专属心意，来看看吧。", url });
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
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

  if (loading) return <main className="publicShell"><div className="publicLoading">正在打开这份心意… ♡</div></main>;
  if (error || !experience) return <main className="publicShell"><section className="publicError"><div className="publicFlower">♡</div><h1>这份心意暂时找不到</h1><p>{error || "请检查分享链接是否正确。"}</p><a href="/">返回首页</a></section></main>;

  return <main className={`publicShell publicTheme-${experience.theme || "rose"}`}> 
    <header className="publicNav"><a href="/" className="publicBrand"><span>♡</span> 心意闯关</a><div className="publicNavActions"><a href="/purchases" className="buyerCreatorLink">我的已解锁</a><button onClick={share} className="shareButton">{copied ? "已复制链接 ✓" : "分享这份心意 ↗"}</button></div></header>
    <section className="publicHero">{experience.coverUrl&&!experience.coverUrl.startsWith("preset:")?<img className="publicCoverImage" src={experience.coverUrl} alt="这份心意的专属封面" style={{objectPosition:experience.coverPosition||"center"}}/>:experience.coverUrl?<div className={`publicCoverPreset publicCover-${experience.coverUrl.slice(7)}`}>♡</div>:null}
      <div className="publicHalo">♡</div>
      <p className="publicEyebrow">A LITTLE JOURNEY FOR YOU</p>
      <h1>{experience.title}</h1>
      <p className="publicDescription">{experience.description || "有人为你准备了一段小小的心意旅程。每打开一扇门，都有一份认真准备的惊喜。"}</p>
      <div className="publicMeta"><span>✦ {experience.levels.length} 份专属心意</span><span>♡ 每一关独立解锁</span></div>
    </section>
    <section className="journeySection">
      <div className="journeyHeading"><div><p className="publicEyebrow">YOUR LITTLE JOURNEY</p><h2>一关一关，慢慢打开</h2></div><span>{experience.levels.length} LEVELS</span></div>
      {experience.levels.length === 0 ? <div className="emptyJourney">这段旅程还在准备中，稍后再来看看吧。</div> :
        <div className="journeyList">{experience.levels.map((level, index) => <article className={selected?.id === level.id ? "journeyCard activeJourney" : "journeyCard"} key={level.id}>
          <div className="journeyNumber">{String(level.position || index + 1).padStart(2, "0")}</div>
          <div className="journeyCopy"><span className="journeyLabel">A LITTLE SECRET</span><h3>{level.title}</h3><p>{level.teaser || "一份为你准备的小惊喜，打开后就能看到更多。"}</p></div>
          <div className="journeyAction"><strong>{money(level.priceMinor, experience.currency || "CNY")}</strong><button disabled={checkingLevel} onClick={() => beginUnlock(level)}>{checkingLevel && selected?.id === level.id ? "确认中…" : unlockedIds.has(level.id) ? "已解锁 · 查看" : selected?.id === level.id ? "查看本关" : "了解这一关"} <span>♡</span></button></div>
        </article>)}</div>}
      <div className="journeyTotal"><span>全部关卡合计（仅供参考）</span><strong>{money(total, experience.currency || "CNY")}</strong></div>
    </section>
    {selected && <section className="unlockNotice" aria-live="polite"><div className="noticeIcon">♡</div><div><b>{selected.title}</b><p>{notice || "选择了这一关。"}</p>{privateContent && <div className="privateContentView">{privateContent}</div>}</div><button onClick={() => setSelected(null)} aria-label="关闭">×</button></section>}
    <footer className="publicFooter"><span>用一点点心意，开启一段小旅程。</span><b>HEART STUDIO ♡</b><small>展示页面 · 真实支付暂未开通</small></footer>
  </main>;
}
