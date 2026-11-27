"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Level = { id: string; position: number; title: string; teaser: string | null; priceMinor: number };
type Experience = { slug: string; title: string; description: string | null; coverUrl: string | null; currency: string; levels: Level[] };

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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/experiences/${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(r.status === 404 ? "这份心意暂时不存在，或尚未发布。" : "暂时无法打开，请稍后再试。");
        return data.experience as Experience;
      })
      .then((data) => { if (alive) setExperience(data); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "加载失败"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [slug]);

  const total = useMemo(() => experience?.levels.reduce((sum, level) => sum + level.priceMinor, 0) ?? 0, [experience]);

  function beginUnlock(level: Level) {
    setSelected(level);
    setNotice("本关价格已展示，但创作者的合规收款通道尚未开通。现在不会发起支付、创建订单或解锁私密内容。");
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: experience?.title ?? "心意闯关", url });
      else { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    } catch { /* sharing was dismissed */ }
  }

  if (loading) return <main className="publicShell"><div className="publicLoading">正在打开这份心意… ♡</div></main>;
  if (error || !experience) return <main className="publicShell"><section className="publicError"><div className="publicFlower">♡</div><h1>这份心意暂时找不到</h1><p>{error || "请检查分享链接是否正确。"}</p><a href="/">返回首页</a></section></main>;

  return <main className="publicShell">
    <header className="publicNav"><a href="/" className="publicBrand"><span>♡</span> 心意闯关</a><div className="publicNavActions"><a href="/purchases" className="buyerCreatorLink">我的已解锁</a><button onClick={share} className="shareButton">{copied ? "已复制链接 ✓" : "分享这份心意 ↗"}</button></div></header>
    <section className="publicHero">
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
          <div className="journeyAction"><strong>{money(level.priceMinor, experience.currency || "CNY")}</strong><button onClick={() => beginUnlock(level)}>{selected?.id === level.id ? "查看本关" : "了解这一关"} <span>♡</span></button></div>
        </article>)}</div>}
      <div className="journeyTotal"><span>全部关卡合计（仅供参考）</span><strong>{money(total, experience.currency || "CNY")}</strong></div>
    </section>
    {selected && <section className="unlockNotice" aria-live="polite"><div className="noticeIcon">♡</div><div><b>{selected.title}</b><p>{notice || "选择了这一关。"}</p></div><button onClick={() => setSelected(null)} aria-label="关闭">×</button></section>}
    <footer className="publicFooter"><span>用一点点心意，开启一段小旅程。</span><b>HEART STUDIO ♡</b><small>展示页面 · 真实支付暂未开通</small></footer>
  </main>;
}
